package media

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	domainemoji "blog-api/internal/domain/emoji"
	"blog-api/internal/application/mocks"
)

// TestUpdateEmoji_MetaSemantics 覆盖 UpdateEmoji 对 meta 的两种语义：
//   - Meta 为 nil（请求体省略 meta 键）：保持原 meta 不变
//   - Meta 为空对象 &EmojiMetaDTO{}（显式清空）：meta 被清空
//
// 区分二者是 REST 更新接口的契约：省略=不更新，显式空值=清空。
func TestUpdateEmoji_MetaSemantics(t *testing.T) {
	originalMeta := domainemoji.ReconstructEmojiMeta("保佑", domainemoji.SizeSmall, domainemoji.TypeNormal)
	original := domainemoji.ReconstructEmoji(1, 10, "[保佑]", "/e.png", "", "", "", 1, originalMeta)

	t.Run("省略meta保持原值", func(t *testing.T) {
		repo := new(mocks.MockEmojiGroupRepository)
		svc := NewEmojiService(repo, "", "", nil, nil)
		repo.On("FindEmojiByID", mock.Anything, int32(1)).Return(original, nil)

		var saved domainemoji.Emoji
		repo.On("SaveEmoji", mock.Anything, mock.Anything).Return(1, nil).Run(func(args mock.Arguments) {
			saved = args.Get(1).(domainemoji.Emoji)
		})

		err := svc.UpdateEmoji(context.Background(), UpdateEmojiInput{ID: 1, Name: "[保佑]"})
		assert.NoError(t, err)
		assert.Equal(t, "保佑", saved.Meta().Alias(), "省略 meta 时应保持原值")
		assert.Equal(t, domainemoji.SizeSmall, saved.Meta().Size())
	})

	t.Run("空对象清空meta", func(t *testing.T) {
		repo := new(mocks.MockEmojiGroupRepository)
		svc := NewEmojiService(repo, "", "", nil, nil)
		repo.On("FindEmojiByID", mock.Anything, int32(1)).Return(original, nil)

		var saved domainemoji.Emoji
		repo.On("SaveEmoji", mock.Anything, mock.Anything).Return(1, nil).Run(func(args mock.Arguments) {
			saved = args.Get(1).(domainemoji.Emoji)
		})

		err := svc.UpdateEmoji(context.Background(), UpdateEmojiInput{ID: 1, Name: "[保佑]", Meta: &EmojiMetaDTO{}})
		assert.NoError(t, err)
		assert.Empty(t, saved.Meta().Alias(), "空对象应清空 alias")
		assert.Zero(t, saved.Meta().Size(), "空对象应清空 size")
	})
}
