// Package engine 的加密测试。
package engine

import (
	"encoding/base64"
	"testing"
)

// TestWeAPIEncrypt_DeterministicWithFixedKey 验证固定 secretKey 时输出确定性。
//
// 同样的输入 + 同样的 secretKey，必须产出同样的 params 和 encSecKey。
// 这是加密可验证性的基础。
func TestWeAPIEncrypt_DeterministicWithFixedKey(t *testing.T) {
	data := `{"ids":"[347230]","level":"standard"}`
	secretKey := "4pC9LBtQ7yF2R8wX"

	first, err := WeAPIEncrypt(data, secretKey)
	if err != nil {
		t.Fatalf("第一次加密失败: %v", err)
	}

	second, err := WeAPIEncrypt(data, secretKey)
	if err != nil {
		t.Fatalf("第二次加密失败: %v", err)
	}

	if first.Params != second.Params {
		t.Error("固定密钥下 params 不一致，期望确定性输出")
	}
	if first.EncSecKey != second.EncSecKey {
		t.Error("固定密钥下 encSecKey 不一致，期望确定性输出")
	}
}

// TestWeAPIEncrypt_ParamsIsBase64 验证 params 是合法 base64。
func TestWeAPIEncrypt_ParamsIsBase64(t *testing.T) {
	result, err := WeAPIEncrypt(`{"test":true}`, "0123456789abcdef")
	if err != nil {
		t.Fatalf("加密失败: %v", err)
	}

	if result.Params == "" {
		t.Error("params 为空")
	}
	// base64 解码验证
	if _, err := base64.StdEncoding.DecodeString(result.Params); err != nil {
		t.Errorf("params 不是合法 base64: %v", err)
	}
}

// TestWeAPIEncrypt_EncSecKeyLength 验证 encSecKey 是 256 位十六进制。
func TestWeAPIEncrypt_EncSecKeyLength(t *testing.T) {
	result, err := WeAPIEncrypt(`{"test":true}`, "0123456789abcdef")
	if err != nil {
		t.Fatalf("加密失败: %v", err)
	}

	if len(result.EncSecKey) != 256 {
		t.Errorf("encSecKey 长度 = %d, 期望 256", len(result.EncSecKey))
	}

	// 验证是合法十六进制
	for _, c := range result.EncSecKey {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			t.Errorf("encSecKey 含非十六进制字符: %c", c)
			break
		}
	}
}

// TestWeAPIEncrypt_RandomKeyVaries 验证随机 secretKey 每次不同。
func TestWeAPIEncrypt_RandomKeyVaries(t *testing.T) {
	data := `{"test":true}`

	first, err := WeAPIEncrypt(data, "")
	if err != nil {
		t.Fatalf("第一次加密失败: %v", err)
	}
	second, err := WeAPIEncrypt(data, "")
	if err != nil {
		t.Fatalf("第二次加密失败: %v", err)
	}

	if first.Params == second.Params {
		t.Error("随机密钥下 params 相同，期望不同")
	}
	if first.EncSecKey == second.EncSecKey {
		t.Error("随机密钥下 encSecKey 相同，期望不同")
	}
}

// TestEAPIEncrypt_ProducesHex 验证 eapi 加密输出是大写十六进制。
func TestEAPIEncrypt_ProducesHex(t *testing.T) {
	result, err := EAPIEncrypt("/api/song/enhance/player/url", `{"ids":"[123]","br":320000}`)
	if err != nil {
		t.Fatalf("eapi 加密失败: %v", err)
	}

	if result.Params == "" {
		t.Error("eapi params 为空")
	}
	// eapi 输出应是大写十六进制
	for _, c := range result.Params {
		if !((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F')) {
			t.Errorf("eapi params 含非大写十六进制字符: %c", c)
			break
		}
	}
}

// TestEAPIEncrypt_Deterministic 验证 eapi 同输入同输出。
func TestEAPIEncrypt_Deterministic(t *testing.T) {
	url := "/api/test"
	data := `{"id":1}`

	first, err := EAPIEncrypt(url, data)
	if err != nil {
		t.Fatalf("第一次失败: %v", err)
	}
	second, err := EAPIEncrypt(url, data)
	if err != nil {
		t.Fatalf("第二次失败: %v", err)
	}

	if first.Params != second.Params {
		t.Error("eapi 同输入输出不一致，期望确定性")
	}
}

// TestReverse 验证字符串反转。
func TestReverse(t *testing.T) {
	tests := []struct {
		input, want string
	}{
		{"abc", "cba"},
		{"a", "a"},
		{"", ""},
		{"ab", "ba"},
	}
	for _, tt := range tests {
		if got := reverse(tt.input); got != tt.want {
			t.Errorf("reverse(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

// TestRandomSecretKey 验证随机密钥长度和字符集。
func TestRandomSecretKey(t *testing.T) {
	key, err := randomSecretKey()
	if err != nil {
		t.Fatalf("生成失败: %v", err)
	}
	if len(key) != 16 {
		t.Errorf("密钥长度 = %d, 期望 16", len(key))
	}

	key2, _ := randomSecretKey()
	if key == key2 {
		t.Error("两次生成的密钥相同，期望随机")
	}
}

// TestPKCS7Pad 验证 PKCS7 填充。
func TestPKCS7Pad(t *testing.T) {
	// 正好整块时补一整块
	padded := pkcs7Pad([]byte("1234567890123456"), 16) // 16 字节正好一块
	if len(padded) != 32 {
		t.Errorf("整块填充后长度 = %d, 期望 32", len(padded))
	}

	// 不足一块时补齐
	padded = pkcs7Pad([]byte("hello"), 16)
	if len(padded) != 16 {
		t.Errorf("5字节填充后长度 = %d, 期望 16", len(padded))
	}
}
