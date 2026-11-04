package media

import (
	"testing"

	"github.com/stretchr/testify/assert"

	domainemoji "blog-api/internal/domain/emoji"
)

func TestEmojiDTOIncludesToken(t *testing.T) {
	assert.Equal(t, "[doge]", emojiToDTO(domainemoji.NewEmoji(1, 2, "doge", "/uploads/emojis/doge.png")).Token)
	assert.Equal(t, "[doge]", emojiToDTO(domainemoji.NewEmoji(1, 2, "[doge]", "/uploads/emojis/doge.png")).Token)
	assert.Equal(t, "", emojiToDTO(domainemoji.NewEmoji(1, 2, "", "")).Token)
}

func TestEmojiGroupDTOIncludesToken(t *testing.T) {
	group, err := domainemoji.NewEmojiGroup(1, "小电视", "bilibili")
	assert.NoError(t, err)
	group.SetEmojis([]domainemoji.Emoji{domainemoji.NewEmoji(2, 1, "doge", "/uploads/emojis/doge.png")})

	dto := emojiGroupToDTO(group)
	assert.Len(t, dto.Emojis, 1)
	assert.Equal(t, "[doge]", dto.Emojis[0].Token)
}
