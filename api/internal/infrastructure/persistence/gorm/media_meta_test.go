package gorm

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainemoji "blog-api/internal/domain/emoji"
)

// TestEmojiMetaRoundtrip 覆盖 domain EmojiMeta 与 JSONB 字节串的双向转换。
// 正常态：三字段齐全，marshal 后能无损还原。
func TestEmojiMetaRoundtrip(t *testing.T) {
	original := domainemoji.ReconstructEmojiMeta("保佑", domainemoji.SizeSmall, domainemoji.TypeNormal)

	b, err := emojiMetaToBytes(original)
	require.NoError(t, err)
	assert.NotEmpty(t, b)

	// 校验 JSON 结构（key 为 alias/size/type）
	var raw map[string]any
	require.NoError(t, json.Unmarshal(b, &raw))
	assert.Equal(t, "保佑", raw["alias"])
	assert.EqualValues(t, 1, raw["size"])
	assert.EqualValues(t, 1, raw["type"])

	got, err := bytesToEmojiMeta(b)
	require.NoError(t, err)
	assert.Equal(t, "保佑", got.Alias())
	assert.Equal(t, domainemoji.SizeSmall, got.Size())
	assert.Equal(t, domainemoji.TypeNormal, got.Type())
}

// TestBytesToEmojiMeta_Tolerant 覆盖从 DB 读取时的容错场景：
//   - 空字节串（旧数据 meta=NULL）：返回零值 meta，不报错
//   - 未知 size/type（B站未来新增取值）：照存，IsValid 为 false 但不阻断
func TestBytesToEmojiMeta_Tolerant(t *testing.T) {
	t.Run("空字节串返回零值meta", func(t *testing.T) {
		got, err := bytesToEmojiMeta(nil)
		require.NoError(t, err)
		assert.Empty(t, got.Alias())
		assert.Zero(t, got.Size())
		assert.Zero(t, got.Type())
	})

	t.Run("未知size和type照存", func(t *testing.T) {
		// B站假设新增 size=3、type=5
		raw := []byte(`{"alias":"x","size":3,"type":5}`)
		got, err := bytesToEmojiMeta(raw)
		require.NoError(t, err)
		assert.Equal(t, "x", got.Alias())
		assert.Equal(t, domainemoji.EmojiSize(3), got.Size())
		assert.False(t, got.Size().IsValid(), "未知 size 不应通过合法性校验，但不阻断存储")
		assert.Equal(t, domainemoji.EmojiType(5), got.Type())
		assert.False(t, got.Type().IsValid())
	})

	t.Run("损坏JSON返回零值不报错", func(t *testing.T) {
		got, err := bytesToEmojiMeta([]byte("{bad"))
		require.NoError(t, err)
		assert.Empty(t, got.Alias(), "损坏数据降级为零值 meta，不阻断读取")
	})
}

// TestEmojiMetaToBytes_Empty 空值 meta 序列化为空字节串（落库时 NULL）。
func TestEmojiMetaToBytes_Empty(t *testing.T) {
	empty := domainemoji.EmojiMeta{}
	b, err := emojiMetaToBytes(empty)
	require.NoError(t, err)
	// 空 meta 不写入 DB（让列保持 NULL），对应 nil
	assert.Nil(t, b)
}
