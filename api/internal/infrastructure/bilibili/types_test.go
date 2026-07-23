package bilibili

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestEmoteUnmarshal 覆盖单个 B站表情 JSON 的反序列化。
// 重点验证此前被丢弃的字段：顶层 type（表情门槛）与 meta 子对象（alias/size）。
// fixture 取自 B站 user/panel/web 真实返回。
func TestEmoteUnmarshal(t *testing.T) {
	raw := `{
		"id": 1903,
		"package_id": 1,
		"text": "[保佑]",
		"url": "https://i0.hdslb.com/bfs/emote/fafe8d3de0dc139ebe995491d2dac458a865fb30.png",
		"mtime": 1668688325,
		"type": 1,
		"meta": {"size": 1, "alias": "保佑"}
	}`

	var emote Emote
	require.NoError(t, json.Unmarshal([]byte(raw), &emote))

	assert.Equal(t, "[保佑]", emote.Text)
	assert.Contains(t, emote.URL, "fafe8d3de0dc139ebe995491d2dac458")
	assert.Equal(t, 1, emote.Type)
	assert.Equal(t, 1, emote.Meta.Size)
	assert.Equal(t, "保佑", emote.Meta.Alias)
}

// TestEmoteUnmarshal_MetaOptional 覆盖 meta 字段缺失时的容错：
// B站部分表情（如颜文字）不返回 meta，反序列化不应报错，meta 为零值。
func TestEmoteUnmarshal_MetaOptional(t *testing.T) {
	raw := `{"text": "[doge]", "url": "https://example.com/doge.png", "type": 1}`

	var emote Emote
	require.NoError(t, json.Unmarshal([]byte(raw), &emote))

	assert.Empty(t, emote.Meta.Alias)
	assert.Zero(t, emote.Meta.Size)
}
