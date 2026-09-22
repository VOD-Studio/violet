// Package crypto 提供凭据的可逆加解密件：密文落库、按需解密展示。
//
// 与哈希是两回事——哈希用于「比对」（鉴权路径，不可逆），TokenBox 用于
// 「保存后还要再读出来」的场景（如 bot 凭据随时查看）。两者可以并存于同一行。
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
)

// ErrOpenFailed 密文无法解开：密钥换了、密文被篡改、或存的根本不是本件产出的串。
var ErrOpenFailed = errors.New("凭据解密失败")

// TokenBox 以 AES-256-GCM 加解密短凭据字符串。
//
// 输出形态为 base64std(nonce || ciphertext)，自含随机 nonce，同一明文两次加密结果不同。
// AEAD 自带完整性校验：篡改密文或换密钥都会让 Open 报 ErrOpenFailed，不会吐出错的明文。
type TokenBox struct {
	aead cipher.AEAD
}

// DeriveKey 把任意长度的配置密钥归一为 32 字节 AES key。
//
// 直接 SHA-256 而不做格式判定：配置项写 hex、base64 还是任意口令都能用，代价是
// 弱口令只靠调用方的长度校验兜底（见 config 对生产环境的 ≥32 字符要求）。
func DeriveKey(raw string) []byte {
	sum := sha256.Sum256([]byte(raw))
	return sum[:]
}

// NewTokenBox 从密钥字节构造 TokenBox。rawKey 长度须为 16/24/32 字节，
// 常规用法传 DeriveKey 的结果即可。
func NewTokenBox(rawKey []byte) (*TokenBox, error) {
	block, err := aes.NewCipher(rawKey)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &TokenBox{aead: aead}, nil
}

// NewTokenBoxFromSecret 从配置里的密钥字符串构造。空串返回 (nil, nil)：
// 未配置密钥是合法状态（存量部署没有这个配置项），由调用方决定降级方式。
func NewTokenBoxFromSecret(raw string) (*TokenBox, error) {
	if raw == "" {
		return nil, nil
	}
	return NewTokenBox(DeriveKey(raw))
}

// Seal 加密明文，返回 base64(nonce || ciphertext)。空串原样返回空串，
// 让「无凭据」与「加密了个空值」在库里长得一样，不必每处调用方都判空。
func (t *TokenBox) Seal(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	nonce := make([]byte, t.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	sealed := t.aead.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

// Open 解开 Seal 的产物。空串返回空串（对应库里没有凭据的行）。
func (t *TokenBox) Open(sealed string) (string, error) {
	if sealed == "" {
		return "", nil
	}
	raw, err := base64.StdEncoding.DecodeString(sealed)
	if err != nil {
		return "", ErrOpenFailed
	}
	ns := t.aead.NonceSize()
	if len(raw) < ns {
		return "", ErrOpenFailed
	}
	plain, err := t.aead.Open(nil, raw[:ns], raw[ns:], nil)
	if err != nil {
		return "", ErrOpenFailed
	}
	return string(plain), nil
}
