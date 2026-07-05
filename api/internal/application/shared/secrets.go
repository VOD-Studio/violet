// Package shared 提供应用层共享的工具函数。
//
// 这些函数从特定模块（如 auth）提升而来，供多个模块复用，避免跨模块私有依赖。
package shared

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
)

// GenerateVerificationCode 生成 6 位数字验证码（crypto/rand 安全随机）。
//
// 用于邮箱验证码场景（注册验证、密码重置、匿名评论验证码等）。
func GenerateVerificationCode() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", fmt.Errorf("生成随机数失败: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// SHA256Hash 计算字符串的 SHA256 十六进制摘要。
//
// 用于验证码哈希存储（不存明文）、ip_hash 等。
func SHA256Hash(input string) string {
	h := sha256.Sum256([]byte(input))
	return hex.EncodeToString(h[:])
}
