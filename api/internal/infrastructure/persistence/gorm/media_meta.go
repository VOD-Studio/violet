package gorm

import (
	"encoding/json"

	domainemoji "blog-api/internal/domain/emoji"
)

// emojiMetaJSON 是 meta JSONB 列的序列化中间结构。
// 与 domain EmojiMeta 的三字段（alias/size/type）对齐。
type emojiMetaJSON struct {
	Alias string `json:"alias,omitempty"`
	Size  int    `json:"size,omitempty"`
	Type  int    `json:"type,omitempty"`
}

// emojiMetaToBytes 将 domain EmojiMeta 序列化为 JSONB 字节串。
// 空 meta（三字段全零值）返回 nil，让 DB 列保持 NULL。
func emojiMetaToBytes(m domainemoji.EmojiMeta) ([]byte, error) {
	if m.Alias() == "" && m.Size() == 0 && m.Type() == 0 {
		return nil, nil
	}
	return json.Marshal(emojiMetaJSON{
		Alias: m.Alias(),
		Size:  int(m.Size()),
		Type:  int(m.Type()),
	})
}

// bytesToEmojiMeta 将 JSONB 字节串还原为 domain EmojiMeta。
// 空字节串（NULL）或损坏 JSON 均降级为零值 meta，不阻断读取（容错存储）。
func bytesToEmojiMeta(b []byte) (domainemoji.EmojiMeta, error) {
	if len(b) == 0 {
		return domainemoji.EmojiMeta{}, nil
	}
	var raw emojiMetaJSON
	if err := json.Unmarshal(b, &raw); err != nil {
		return domainemoji.EmojiMeta{}, nil
	}
	return domainemoji.ReconstructEmojiMeta(raw.Alias, domainemoji.EmojiSize(raw.Size), domainemoji.EmojiType(raw.Type)), nil
}
