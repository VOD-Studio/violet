// Package doctor 实现 musicctl doctor 命令:逐项环境自检。
//
// 检查项:版本(build info)/会话与网络(一次轻量 rpc)/补全安装指引/音频后端。
// 渲染层输出(✓/✗/! 清单 + 每项修复指引),任一 fail → exit 1;warn 不影响。
// --json 白拿,bug report 可粘贴(PRD-0014 #J)。
//
// 设计:doctor 是协调器,检查逻辑由可注入的 Checker 列表提供(表驱动),
// 生产装配真实检查器(注入 endpoint/cookie/audio),测试用 fake。这让 doctor
// 易测且与具体 endpoint 解耦。
package doctor

import (
	"fmt"
	"io"
	"strings"
)

// Status 是检查项的结果状态。
type Status string

const (
	StatusPass Status = "pass" // ✓ 通过
	StatusFail Status = "fail" // ✗ 失败(影响退出码 → exit 1)
	StatusWarn Status = "warn" // ! 警告(不影响退出码,合法场景如 headless 无音频)
)

// icon 是状态对应的符号(人类渲染用)。
func (s Status) icon() string {
	switch s {
	case StatusPass:
		return "✓"
	case StatusFail:
		return "✗"
	case StatusWarn:
		return "!"
	default:
		return "?"
	}
}

// Result 是单个检查项的结果。
type Result struct {
	Name    string `json:"name"`              // 检查项名(如「版本」「会话」)
	Status  Status `json:"status"`            // pass/fail/warn
	Detail  string `json:"detail"`            // 状态详情(如版本号、「未登录」)
	FixHint string `json:"fix_hint,omitempty"` // 非 pass 时的修复指引
}

// Checker 是一个检查项的接口。Check 执行检查返回 Result。
// 生产实现注入具体依赖(endpoint/cookie/audio);测试用 fake。
type Checker interface {
	Check() Result
}

// CheckerFunc 让普通函数实现 Checker。
type CheckerFunc func() Result

func (f CheckerFunc) Check() Result { return f() }

// Run 执行所有检查项,返回结果列表与是否有 fail。
// 顺序:按 checkers 传入顺序(渲染时保持)。
func Run(checkers []Checker) []Result {
	results := make([]Result, 0, len(checkers))
	for _, c := range checkers {
		results = append(results, c.Check())
	}
	return results
}

// HasFail 判断结果列表是否有 fail 项(决定退出码)。
func HasFail(results []Result) bool {
	for _, r := range results {
		if r.Status == StatusFail {
			return true
		}
	}
	return false
}

// RenderHuman 渲染人类可读的逐项清单(✓/✗/! + 详情 + 修复指引)。
// 用于 TTY 默认输出。
func RenderHuman(w io.Writer, results []Result) {
	// 对齐:取最长 Name 宽度。
	maxName := 0
	for _, r := range results {
		if l := len(r.Name); l > maxName {
			maxName = l
		}
	}
	for _, r := range results {
		pad := strings.Repeat(" ", maxName-len(r.Name))
		fmt.Fprintf(w, "%s %s%s   %s\n", r.Status.icon(), r.Name, pad, r.Detail)
		if r.FixHint != "" {
			fmt.Fprintf(w, "        → %s\n", r.FixHint)
		}
	}
}

// RenderJSON 输出结构化 JSON(供 --json / bug report 粘贴)。
type reportJSON struct {
	Results []Result `json:"results"`
	OK      bool     `json:"ok"` // 无 fail 为 true
}

// ReportJSON 构造 JSON 报告(含 results + ok 汇总)。
func ReportJSON(results []Result) reportJSON {
	return reportJSON{Results: results, OK: !HasFail(results)}
}
