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

// TestEAPIEncrypt_GoldenVector 用 chaunsin/netease-cloud-music 的已知向量锚定
// eapi 加密（AES-ECB-128 + digest path 转换）正确性。
//
// 输入 path "/test/url" 不含 "eapi"，故 digest path 不变。data 传 JSON 编码后的
// 带引号字符串 "\"test value\""：我的 EAPIEncrypt 接收「已序列化的 JSON」，对应
// chaunsin EApiEncrypt 内部 json.Marshal("test value") 产生的带引号串。
func TestEAPIEncrypt_GoldenVector(t *testing.T) {
	t.Parallel()

	result, err := EAPIEncrypt("/test/url", `"test value"`)
	if err != nil {
		t.Fatalf("eapi 加密失败: %v", err)
	}

	const want = "E556EA4892989E4A1B98043B56CD3C77C6DBE3D0261A0FA8ACF45E2882DBABFD13F52E05D9EF39C101A7A46DD0E0CD0979A2DD9CE30975861F6F4E86855FE00AD841C36BA90177218D0D8D32A54A0DC4"
	if result.Params != want {
		t.Errorf("eapi params 不匹配外部 Go 实现（chaunsin）\n got: %s\nwant: %s", result.Params, want)
	}
}

// TestEAPIEncrypt_ProducesHex 验证 eapi 加密输出是大写十六进制。
func TestEAPIEncrypt_ProducesHex(t *testing.T) {
	t.Parallel()

	result, err := EAPIEncrypt("/eapi/song/enhance/player/url", `{"ids":"[123]","br":320000}`)
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

// TestEAPIEncrypt_DigestPathConversion 验证 eapi 把 wire path /eapi/... 转成
// digest path /api/... 后再算摘要：同一 data 下 /eapi/x 与 /api/x 摘要应一致。
func TestEAPIEncrypt_DigestPathConversion(t *testing.T) {
	t.Parallel()

	const data = `{"songId":1}`
	fromWire, err := EAPIEncrypt("/eapi/song/red/count", data)
	if err != nil {
		t.Fatalf("wire path 加密失败: %v", err)
	}
	fromDigest, err := EAPIEncrypt("/api/song/red/count", data)
	if err != nil {
		t.Fatalf("digest path 加密失败: %v", err)
	}

	if fromWire.Params != fromDigest.Params {
		t.Error("eapi 未把 /eapi/ wire path 转成 /api/ digest path：两者摘要应一致")
	}
}

// TestEAPIEncrypt_Deterministic 验证 eapi 同输入同输出。
func TestEAPIEncrypt_Deterministic(t *testing.T) {
	t.Parallel()

	url := "/eapi/test"
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
