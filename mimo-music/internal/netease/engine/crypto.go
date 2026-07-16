// Package engine 是网易云共享执行引擎。
//
// crypto.go 用 Go 标准库（crypto/aes + crypto/rsa）自实现网易云 weapi / eapi 加密，
// 不依赖任何第三方音乐库。加密算法来自网易云网页端公开的 JS 代码。
package engine

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/md5"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
)

// 网易云 weapi 加密的公开预设常量。
//
// 这些值来自网易云网页端 music.163.com 的公开 JS 文件，是固定的公开参数，
// 不是密钥泄漏。weapi 协议靠 RSA 保护每次随机的 secretKey，预设值本身无保密价值。
const (
	// weapiNonce 是第一轮 AES 加密的预设 key（明文字符串，16 字节）。
	weapiNonce = "0CoVUmhQ0d8IhkAL"

	// weapiPubKey 是 RSA 加密的公钥 modulus（十六进制字符串）。
	weapiPubKey = "010001"

	// weapiModulus 是 RSA 加密的 modulus（十六进制字符串）。
	weapiModulus = "00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7"

	// eapiKey 是 eapi 加密的 AES key（明文字符串，16 字节）。
	eapiKey = "e82ckenh8dichen8"
)

// WeAPIEncrypted 是 weapi 加密后的请求参数。
type WeAPIEncrypted struct {
	// Params 是 AES 两轮加密后的业务数据（base64）。
	Params string

	// EncSecKey 是 RSA 加密后的 secretKey 反转值（十六进制）。
	EncSecKey string
}

// WeAPIEncrypt 用 weapi 协议加密请求数据。
//
// 流程：
//  1. 生成 16 位随机 secretKey
//  2. 用预设 nonce 对数据做第一轮 AES-CBC-128 加密，再用 secretKey 做第二轮
//  3. 对 secretKey 反转后用 RSA（公钥 + modulus）加密得到 encSecKey
//
// 如果传入固定 secretKey（测试用），则输出确定性。
func WeAPIEncrypt(data string, secretKey string) (WeAPIEncrypted, error) {
	if secretKey == "" {
		var err error
		secretKey, err = randomSecretKey()
		if err != nil {
			return WeAPIEncrypted{}, fmt.Errorf("生成随机密钥失败: %w", err)
		}
	}

	// nonce 和 secretKey 都是 16 字节明文字符串，直接用作 AES key
	nonceBytes := []byte(weapiNonce)

	// 第一轮：用 nonce 加密
	firstRound, err := aesCBCEncrypt(data, nonceBytes)
	if err != nil {
		return WeAPIEncrypted{}, fmt.Errorf("第一轮 AES 加密失败: %w", err)
	}

	// 第二轮：用 secretKey 加密
	secondRound, err := aesCBCEncrypt(firstRound, []byte(secretKey))
	if err != nil {
		return WeAPIEncrypted{}, fmt.Errorf("第二轮 AES 加密失败: %w", err)
	}

	// RSA 加密反转后的 secretKey
	encSecKey := rsaEncryptFixed(reverse(secretKey))

	return WeAPIEncrypted{
		Params:    secondRound,
		EncSecKey: encSecKey,
	}, nil
}

// EAPIEncrypted 是 eapi 加密后的请求参数。
type EAPIEncrypted struct {
	// Params 是 AES 加密后的数据（十六进制大写）。
	Params string
}

// EAPIEncrypt 用 eapi 协议加密请求数据。
//
// 流程：
//  1. 把传入的 wire path（/eapi/...）转换成 digest path（/api/...）：eapi 接口的
//     HTTP 请求发往 /eapi/...，但 digest 与加密明文里嵌的是 /api/... 形式（网易云
//     服务端按 /api/... 校验摘要）。两者分离是 eapi 协议约定，与 weapi 不同。
//  2. 对 digest path + data 做 MD5 摘要得到 digest
//  3. 用固定 key (eapiKey) 对 "digestpath-36cd479b6b5-data-36cd479b6b5-digest"
//     做 AES-ECB-128 加密，输出大写十六进制
//
// url 传入的是 wire path（engine 的 meta.Path，形如 /eapi/song/red/count）。
func EAPIEncrypt(url, data string) (EAPIEncrypted, error) {
	// digest path：/eapi/... → /api/...（只替换首次出现的 eapi，覆盖 /eapi/ 前缀）。
	digestURL := strings.Replace(url, "eapi", "api", 1)

	digest := md5Hex(fmt.Sprintf("nobody%suse%smd5forencrypt", digestURL, data))
	plaintext := fmt.Sprintf("%s-36cd479b6b5-%s-36cd479b6b5-%s", digestURL, data, digest)

	// eapiKey 是 16 字节明文字符串，直接用作 AES key
	key := []byte(eapiKey)

	encrypted, err := aesECBEncryptHex(plaintext, key)
	if err != nil {
		return EAPIEncrypted{}, fmt.Errorf("eapi AES 加密失败: %w", err)
	}

	return EAPIEncrypted{Params: encrypted}, nil
}

// aesCBCEncrypt 用 AES-CBC-128 加密，返回 base64 编码的密文。
//
// PKCS7 填充，IV 固定为 "0102030405060708"（网易云网页端约定）。
func aesCBCEncrypt(plaintext string, key []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	iv := []byte("0102030405060708")
	padded := pkcs7Pad([]byte(plaintext), block.BlockSize())

	ciphertext := make([]byte, len(padded))
	mode := cipher.NewCBCEncrypter(block, iv)
	mode.CryptBlocks(ciphertext, padded)

	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// aesECBEncryptHex 用 AES-ECB-128 加密，返回十六进制大写编码的密文（eapi 用）。
//
// eapi 协议用 ECB 模式（无 IV），与 weapi 的 CBC 不同。PKCS7 填充。
func aesECBEncryptHex(plaintext string, key []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	padded := pkcs7Pad([]byte(plaintext), block.BlockSize())
	ciphertext := make([]byte, len(padded))
	// ECB 逐块加密（Go 标准库未提供 ECB 的便利封装，手动逐块）。
	bs := block.BlockSize()
	for start := 0; start < len(padded); start += bs {
		block.Encrypt(ciphertext[start:start+bs], padded[start:start+bs])
	}

	return fmt.Sprintf("%0X", ciphertext), nil
}

// pkcs7Pad 做 PKCS7 填充。
func pkcs7Pad(data []byte, blockSize int) []byte {
	padding := blockSize - len(data)%blockSize
	padText := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(data, padText...)
}

// randomSecretKey 生成 16 位随机小写字母数字密钥。
func randomSecretKey() (string, error) {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	buf := make([]byte, 16)
	for i := range buf {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		buf[i] = charset[n.Int64()]
	}
	return string(buf), nil
}

// reverse 反转字符串。
func reverse(s string) string {
	r := []byte(s)
	for i, j := 0, len(r)-1; i < j; i, j = i+1, j-1 {
		r[i], r[j] = r[j], r[i]
	}
	return string(r)
}

// rsaEncryptFixed 用网易云固定公钥做 RSA 加密（无填充，教科书式模幂）。
//
// 网易云的 RSA 不是标准 PKCS，而是教科书式：明文转大整数后直接 modpow。
// 输入是反转后的 secretKey 的 ASCII 码拼成十六进制。
func rsaEncryptFixed(reversedKey string) string {
	// 把 reversedKey 的每个字符转成十六进制 ASCII 码拼接
	hexStr := ""
	for _, c := range reversedKey {
		hexStr += fmt.Sprintf("%02x", c)
	}

	// 大整数：plaintext^pubKey mod modulus
	plaintext, _ := new(big.Int).SetString(hexStr, 16)
	pubKey, _ := new(big.Int).SetString(weapiPubKey, 16)
	modulus, _ := new(big.Int).SetString(weapiModulus, 16)

	result := new(big.Int).Exp(plaintext, pubKey, modulus)
	// 左侧补零到 256 位十六进制
	return fmt.Sprintf("%0256x", result)
}

// md5Hex 返回字符串的 MD5 十六进制摘要。
func md5Hex(s string) string {
	h := md5.Sum([]byte(s))
	return hex.EncodeToString(h[:])
}
