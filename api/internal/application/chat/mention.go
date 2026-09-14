package chat

import (
	"regexp"

	domainshared "blog-api/internal/domain/shared"
)

// mentionTokenPattern 匹配聊天正文中的提及占位符 @(username:uuid)。
//
// 提及与自定义表情 token 同为正文内联占位符：关系不落表，读路径从正文解析。
// 占位符内嵌用户名是为了在解析不到用户（注销、改名）时前端仍能兜底渲染，
// uuid 段才是权威身份；username 段与 domain/user 的 usernamePattern 一致。
var mentionTokenPattern = regexp.MustCompile(`@\(([a-zA-Z0-9_-]{3,32}):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)`)

// parseMentionTokens 解析正文中的提及占位符。
//
// 返回按首次出现顺序去重的被提及用户 ID，以及 ID → 命中的全部 token 原文
// （同一用户可被提及多次，每个 token 都要能索引到同一解析结果）。
func parseMentionTokens(content string) ([]domainshared.ID, map[domainshared.ID][]string) {
	if content == "" {
		return nil, nil
	}
	var ids []domainshared.ID
	tokensByID := make(map[domainshared.ID][]string)
	for _, match := range mentionTokenPattern.FindAllStringSubmatch(content, -1) {
		id, err := domainshared.ParseID(match[2])
		if err != nil {
			continue
		}
		if _, seen := tokensByID[id]; !seen {
			ids = append(ids, id)
		}
		tokensByID[id] = append(tokensByID[id], match[0])
	}
	if len(ids) == 0 {
		return nil, nil
	}
	return ids, tokensByID
}

// humanizeMentionTokens 把提及占位符还原成 @username，供预览等人类可读场景使用。
func humanizeMentionTokens(content string) string {
	return mentionTokenPattern.ReplaceAllString(content, "@$1")
}

// mentionIDStrings 把被提及 ID 列表转成事件 payload 可序列化的字符串数组。
func mentionIDStrings(ids []domainshared.ID) []string {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		out = append(out, id.String())
	}
	return out
}
