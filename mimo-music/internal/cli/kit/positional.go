// 位置参数 helper:--id flag 与位置参数(args[0])的统一解析。
//
// 动机(issue #24 / PRD 便捷性):`song download 347230` ≡ `song download --id 347230`,
// 对齐 git/kubectl 习惯。规则:位置参数与 --id 互斥(同时指定 → 用法错误)。
package kit

import (
	"fmt"
	"strconv"
)

// ResolveID 从 --id flag 或位置参数 args[0] 解析 id(歌曲/歌单通用)。
//
// 规则(PRD-0013 便捷性 / CONTEXT.md 位置参数术语):
//   - flagID 非 0 且 args 有值 → ErrUsage「不能同时指定 --id 和位置参数」
//   - 两者都缺 → ErrUsage「缺少 id」
//   - 仅 flagID → 返回 flagID
//   - 仅位置参数 → 解析为 int64;非数字 → ErrUsage
//
// 位置参数不进 tab 补全(补全只走召回池,见 CONTEXT.md「补全只走缓存」)。
// 调用方需先把 cobra.Args 设为 cobra.MaximumNArgs(1) 并 drop MarkFlagRequired("id")。
func ResolveID(flagID int64, args []string) (int64, error) {
	hasFlag := flagID != 0
	hasPos := len(args) > 0 && args[0] != ""
	if hasFlag && hasPos {
		return 0, fmt.Errorf("%w:不能同时指定 --id 和位置参数", ErrUsage)
	}
	if !hasFlag && !hasPos {
		return 0, fmt.Errorf("%w:缺少 id(用 --id 或位置参数)", ErrUsage)
	}
	if hasPos {
		n, err := strconv.ParseInt(args[0], 10, 64)
		if err != nil {
			return 0, fmt.Errorf("%w:位置参数 %q 不是合法 id", ErrUsage, args[0])
		}
		return n, nil
	}
	return flagID, nil
}

// ResolveKeyword 从 --keyword flag 或位置参数 args[0] 解析关键词(search 用)。
// 规则同 ResolveID:flag 与位置参数互斥(同时指定 → ErrUsage);两者都缺 → ErrUsage。
func ResolveKeyword(flagKeyword string, args []string) (string, error) {
	hasFlag := flagKeyword != ""
	hasPos := len(args) > 0 && args[0] != ""
	if hasFlag && hasPos {
		return "", fmt.Errorf("%w:不能同时指定 --keyword 和位置参数", ErrUsage)
	}
	if !hasFlag && !hasPos {
		return "", fmt.Errorf("%w:缺少搜索关键词(用 --keyword 或位置参数)", ErrUsage)
	}
	if hasPos {
		return args[0], nil
	}
	return flagKeyword, nil
}
