package shared

import (
	"testing"

	"github.com/stretchr/testify/assert"

	domainshared "blog-api/internal/domain/shared"
)

func TestParseCustomEmojiToken(t *testing.T) {
	id := domainshared.NewID()

	parsed, ok := ParseCustomEmojiToken("mycat:" + id.String())

	assert.True(t, ok)
	assert.True(t, parsed.Equal(id))
}

func TestSplitCustomEmojiTokens(t *testing.T) {
	id := domainshared.NewID()
	tokens := SplitCustomEmojiTokens([]string{
		"[doge]",
		"[mycat:" + id.String() + "]",
		"[other:" + id.String() + "]",
	})

	assert.True(t, tokens.SystemNames["[doge]"])
	assert.Equal(t, []domainshared.ID{id}, tokens.IDs)
	assert.Equal(t, []string{"[mycat:" + id.String() + "]", "[other:" + id.String() + "]"}, tokens.TokensByID[id])
}

func TestEmojiToken(t *testing.T) {
	assert.Equal(t, "[doge]", EmojiToken("doge"))
	assert.Equal(t, "[doge]", EmojiToken("[doge]"))
	assert.Equal(t, "", EmojiToken(""))
	assert.Equal(t, "[(╯°□°）╯]", EmojiToken("(╯°□°）╯"))
}

func TestFormatCustomEmojiToken(t *testing.T) {
	id := domainshared.MustParseID("11111111-1111-1111-1111-111111111111")
	assert.Equal(t, "[mycat:11111111-1111-1111-1111-111111111111]", FormatCustomEmojiToken("mycat", id))
	assert.Equal(t, "[猫 咪:11111111-1111-1111-1111-111111111111]", FormatCustomEmojiToken("猫 咪", id))
}
