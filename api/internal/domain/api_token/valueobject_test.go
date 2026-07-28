package apitoken

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGenerateToken_Format(t *testing.T) {
	raw, err := GenerateToken()
	assert.NoError(t, err)
	assert.True(t, strings.HasPrefix(raw, TokenPrefix),
		"token 必须以 %s 开头，实际: %s", TokenPrefix, raw)
	// violet_pat_ (12) + 32 字节 base64url (≈43 字符) > 40
	assert.Greater(t, len(raw), 40, "token 随机部分应足够长")
}

func TestGenerateToken_Uniqueness(t *testing.T) {
	a, _ := GenerateToken()
	b, _ := GenerateToken()
	assert.NotEqual(t, a, b, "每次生成必须唯一")
}

func TestHashToken_Deterministic(t *testing.T) {
	tok := "violet_pat_testtoken123"
	h1 := HashToken(tok)
	h2 := HashToken(tok)
	assert.Equal(t, h1, h2, "同一 token 哈希必须相同")

	// 独立验证：手算 SHA-256 hex 应与函数一致
	sum := sha256.Sum256([]byte(tok))
	assert.Equal(t, hex.EncodeToString(sum[:]), h1, "哈希应为 SHA-256 hex")
}

func TestHashToken_DiffersForDifferentTokens(t *testing.T) {
	assert.NotEqual(t, HashToken("a"), HashToken("b"))
}

func TestHashToken_ConstantLength(t *testing.T) {
	// SHA-256 hex 固定 64 字符
	assert.Equal(t, 64, len(HashToken("anything")))
}
