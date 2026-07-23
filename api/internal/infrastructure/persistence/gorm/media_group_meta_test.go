package gorm

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainemoji "blog-api/internal/domain/emoji"
)

// TestEmojiGroupMetaRoundtrip 覆盖 EmojiGroup 的 meta（分组级 size）在 PO↔domain 转换中的保持。
// 分组级 meta 仅 size 有意义（picker 渲染），alias/type 为零值。
func TestEmojiGroupMetaRoundtrip(t *testing.T) {
	original := domainemoji.ReconstructEmojiGroup(
		1, "拜年纪2022", domainemoji.SourceBilibili, "/cover.png", 1, true,
		domainemoji.GroupTypeImage,
		[]domainemoji.Emoji{},
		domainemoji.ReconstructEmojiMeta("", domainemoji.SizeLarge, 0),
	)

	po := emojiGroupToPO(original)
	assert.NotNil(t, po.Meta, "分组 meta 应序列化为非空 JSONB")

	got, err := emojiGroupToDomain(po)
	require.NoError(t, err)
	assert.Equal(t, domainemoji.SizeLarge, got.Meta().Size(), "分组 size 应保持为 2（大）")
	assert.Empty(t, got.Meta().Alias(), "分组级 alias 应为零值")
}

// TestEmojiGroupMetaNil 分组无 meta（旧数据或自定义分组）时 PO.Meta 为 nil，转回 domain 为零值。
func TestEmojiGroupMetaNil(t *testing.T) {
	original := domainemoji.ReconstructEmojiGroup(
		2, "自定义", domainemoji.SourceCustom, "", 1, true,
		domainemoji.GroupTypeImage,
		nil, domainemoji.EmojiMeta{},
	)

	po := emojiGroupToPO(original)
	assert.Nil(t, po.Meta, "空 meta 应落库为 NULL")

	got, err := emojiGroupToDomain(po)
	require.NoError(t, err)
	assert.Zero(t, got.Meta().Size())
}
