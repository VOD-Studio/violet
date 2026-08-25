package shared

import (
	"context"
	"regexp"
	"strings"

	domainshared "blog-api/internal/domain/shared"
)

// CustomEmojiTokens 将一批正文占位符拆分为系统表情名称与自定义表情 ID。
type CustomEmojiTokens struct {
	SystemNames map[string]bool
	IDs         []domainshared.ID
	TokensByID  map[domainshared.ID][]string
}

// ParseCustomEmojiToken 解析不含方括号的自定义表情 token。
func ParseCustomEmojiToken(content string) (domainshared.ID, bool) {
	idx := strings.LastIndex(content, ":")
	if idx < 0 {
		return domainshared.ID{}, false
	}
	id, err := domainshared.ParseID(content[idx+1:])
	if err != nil {
		return domainshared.ID{}, false
	}
	return id, true
}

// inlineImagePlaceholder 匹配富文本内联图片占位符 ![img:<id>]。
var inlineImagePlaceholder = regexp.MustCompile(`!\[img:[^\]]+\]`)

// WithoutInlineImagePlaceholders 剥离正文中的内联图片占位符。
// 表情 token 扫描/校验必须先剥离：否则占位符尾段 [img:<uuid>] 会被
// `\[([^\]]+)\]` 误判为自定义表情 token，media UUID 进入表情权限校验报 FORBIDDEN。
func WithoutInlineImagePlaceholders(content string) string {
	return inlineImagePlaceholder.ReplaceAllString(content, "")
}

// CustomEmojiContentValidator 校验正文中的自定义表情是否允许当前用户使用。
type CustomEmojiContentValidator interface {
	ValidateContent(ctx context.Context, content string, viewerID domainshared.ID) error
}

// SplitCustomEmojiTokens 分离系统表情名称与自定义表情 token，并去重 ID。
func SplitCustomEmojiTokens(names []string) CustomEmojiTokens {
	result := CustomEmojiTokens{
		SystemNames: make(map[string]bool, len(names)),
		TokensByID:  make(map[domainshared.ID][]string, len(names)),
	}
	seenIDs := make(map[domainshared.ID]struct{}, len(names))
	for _, name := range names {
		if len(name) >= 2 {
			if id, ok := ParseCustomEmojiToken(name[1 : len(name)-1]); ok {
				result.TokensByID[id] = append(result.TokensByID[id], name)
				if _, seen := seenIDs[id]; !seen {
					seenIDs[id] = struct{}{}
					result.IDs = append(result.IDs, id)
				}
				continue
			}
		}
		result.SystemNames[name] = true
	}
	return result
}
