package customemoji

import (
	"strings"

	"blog-api/internal/domain/shared"
)

// ParseToken 解析表情占位符括号内内容（不含方括号），判断是否为自定义表情
// token（形如 "name:<uuid>"）。系统表情 token 形如 "name"（无冒号）或冒号后
// 非合法 UUID，返回 ok=false，调用方应回退到按名称查找系统表情的现状逻辑。
//
// 按最后一个冒号切分：名称部分允许包含冒号，只要求末段是合法 UUID。
func ParseToken(content string) (id shared.ID, ok bool) {
	idx := strings.LastIndex(content, ":")
	if idx < 0 {
		return shared.ID{}, false
	}
	parsed, err := shared.ParseID(content[idx+1:])
	if err != nil {
		return shared.ID{}, false
	}
	return parsed, true
}
