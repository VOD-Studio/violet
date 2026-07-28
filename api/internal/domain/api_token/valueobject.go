// Package apitoken 定义个人访问令牌（PAT）领域模型。
//
// PAT 是供 AI agent / 机器客户端鉴权的程序化凭证，以 Bearer 方式呈现，
// 取代浏览器专用 session cookie。明文仅在创建时返回一次，库中只存哈希。
package apitoken

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
)

// TokenPrefix PAT 明文前缀，便于人眼与日志识别。
const TokenPrefix = "violet_pat_"

// GenerateToken 生成明文 PAT：前缀 + 32 字节 cryptographically random（base64url）。
//
// 读 crypto/rand 失败返回错误，绝不降级为弱随机——token 一旦可预测，
// 整个委托鉴权体系崩塌。调用方必须把错误当 500 处理。
func GenerateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return TokenPrefix + base64.RawURLEncoding.EncodeToString(b), nil
}

// HashToken 对明文 token 取 SHA-256 hex。
//
// 库中只存哈希：明文 token 泄露后无法从哈希反推；校验时对入参同样哈希再比对。
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
