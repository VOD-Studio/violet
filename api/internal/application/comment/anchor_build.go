package comment

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"unicode/utf16"

	domain "blog-api/internal/domain/comment"
	"blog-api/internal/domain/shared"
)

// ComputeBlockID 计算块纯文本的 block_id（SHA-256 前 8 位 hex）。
// 与前端 web/src/features/comments/lib/block-id.ts 一致：先 TrimSpace，空文本返回错误。
// 领域注释仍写 SHA-1，前端因 Web Crypto 限制改用 SHA-256；MCP/服务端对齐前端。
func ComputeBlockID(text string) (string, error) {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return "", shared.BadRequest("块文本为空，无法计算 block_id")
	}
	sum := sha256.Sum256([]byte(trimmed))
	return hex.EncodeToString(sum[:])[:8], nil
}

// utf16Len 返回与 JavaScript string.length 一致的 UTF-16 code unit 长度。
// 前端 offset 以 DOM textContent 的 JS 长度为基准，段评/批注 end_offset 必须对齐。
func utf16Len(s string) int {
	return len(utf16.Encode([]rune(s)))
}

// BuildFullBlockAnchor 构造段评锚点：覆盖整块（start=0, end=JS 长度，selected_text=全文）。
// 与前端 BlockCommentTrigger 提交形态一致。
func BuildFullBlockAnchor(blockText string) (*domain.Anchor, error) {
	id, err := ComputeBlockID(blockText)
	if err != nil {
		return nil, err
	}
	end := utf16Len(blockText)
	if end == 0 {
		return nil, shared.BadRequest("块文本为空，无法段评")
	}
	return &domain.Anchor{
		BlockID:       id,
		StartOffset:   0,
		EndOffset:     end,
		SelectedText:  blockText,
		BlockHashSync: id,
	}, nil
}

// ResolveAnnotationAnchor 解析划线批注锚点。
// 优先使用调用方给出的五元组；若缺 block_id / block_text_hash 且提供了 block_text，则按前端算法补齐。
func ResolveAnnotationAnchor(blockID string, start, end int, selectedText, blockHash, blockText string) (*domain.Anchor, error) {
	if selectedText == "" {
		return nil, shared.BadRequest("划线批注需要 selected_text")
	}
	if blockText != "" {
		id, err := ComputeBlockID(blockText)
		if err != nil {
			return nil, err
		}
		if blockID == "" {
			blockID = id
		} else if blockID != id {
			return nil, shared.BadRequest(fmt.Sprintf("block_id=%q 与 block_text 推导值 %q 不一致", blockID, id))
		}
		if blockHash == "" {
			blockHash = id
		} else if blockHash != id {
			return nil, shared.BadRequest(fmt.Sprintf("block_text_hash=%q 与 block_text 推导值 %q 不一致", blockHash, id))
		}
		units := utf16.Encode([]rune(blockText))
		if start < 0 || end <= start || end > len(units) {
			return nil, shared.BadRequest(fmt.Sprintf("offset 越界：start_offset=%d end_offset=%d，block_text 长度（UTF-16）=%d", start, end, len(units)))
		}
		if got := string(utf16.Decode(units[start:end])); got != selectedText {
			return nil, shared.BadRequest(fmt.Sprintf("selected_text 与 block_text[%d:%d]（UTF-16）不一致：实际为 %q", start, end, got))
		}
	}
	a := &domain.Anchor{
		BlockID:       blockID,
		StartOffset:   start,
		EndOffset:     end,
		SelectedText:  selectedText,
		BlockHashSync: blockHash,
	}
	if err := a.Validate(); err != nil {
		return nil, err
	}
	return a, nil
}
