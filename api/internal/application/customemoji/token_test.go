package customemoji

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"blog-api/internal/domain/shared"
)

func TestParseToken(t *testing.T) {
	validID := shared.NewID()

	t.Run("name:uuid 解析出 ID", func(t *testing.T) {
		id, ok := ParseToken("mycat:" + validID.String())
		assert.True(t, ok)
		assert.True(t, id.Equal(validID))
	})

	t.Run("纯名称无冒号，非自定义表情 token", func(t *testing.T) {
		_, ok := ParseToken("doge")
		assert.False(t, ok)
	})

	t.Run("冒号后非合法 UUID，非自定义表情 token", func(t *testing.T) {
		_, ok := ParseToken("doge:not-a-uuid")
		assert.False(t, ok)
	})

	t.Run("名称本身含冒号，仍按末段 UUID 解析", func(t *testing.T) {
		id, ok := ParseToken("a:b:" + validID.String())
		assert.True(t, ok)
		assert.True(t, id.Equal(validID))
	})
}
