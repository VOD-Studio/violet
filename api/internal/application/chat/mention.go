package chat

import (
	"regexp"
	"strings"
	"unicode"

	domainshared "blog-api/internal/domain/shared"
)

// leadingCommandTarget 只识别正文开头的提及加斜杠命令，参数中的提及不参与寻址。
func leadingCommandTarget(content string) (domainshared.ID, bool) {
	if !strings.HasPrefix(content, "@(") {
		return domainshared.ID{}, false
	}
	end := strings.IndexByte(content, ')')
	if end < 0 || end+1 >= len(content) {
		return domainshared.ID{}, false
	}
	rest := content[end+1:]
	trimmed := strings.TrimLeftFunc(rest, unicode.IsSpace)
	if trimmed == rest {
		return domainshared.ID{}, false
	}
	rest = trimmed
	if !strings.HasPrefix(rest, "/") || strings.HasPrefix(rest, "//") {
		return domainshared.ID{}, false
	}
	token := content[:end+1]
	match := mentionTokenPattern.FindStringSubmatchIndex(token)
	if len(match) < 6 || match[0] != 0 || match[1] != len(token) {
		return domainshared.ID{}, true
	}
	id, _ := domainshared.ParseID(token[match[4]:match[5]])
	return id, true
}

// mentionTokenPattern 匹配用户提及 @(username:uuid) 与全体提及 @(all:all)。
//
// 提及与自定义表情 token 同为正文内联占位符：关系不落表，读路径从正文解析。
// 占位符内嵌用户名是为了在解析不到用户（注销、改名）时前端仍能兜底渲染，
// uuid 段才是权威身份；username 段与 domain/user 的 usernamePattern 一致。
var mentionTokenPattern = regexp.MustCompile(`@\(([a-zA-Z0-9_-]{3,32}):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|all)\)`)

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

func hasMentionAll(content string) bool {
	for _, match := range mentionTokenPattern.FindAllStringSubmatch(content, -1) {
		if match[2] == "all" {
			return true
		}
	}
	return false
}

// humanizeMentionTokens 将用户与全体提及还原为可读预览。
func humanizeMentionTokens(content string) string {
	return mentionTokenPattern.ReplaceAllStringFunc(content, func(token string) string {
		match := mentionTokenPattern.FindStringSubmatch(token)
		if match[2] == "all" {
			return "@所有人"
		}
		return "@" + match[1]
	})
}

// mentionIDStrings 把被提及 ID 列表转成事件 payload 可序列化的字符串数组。
func mentionIDStrings(ids []domainshared.ID) []string {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		out = append(out, id.String())
	}
	return out
}
