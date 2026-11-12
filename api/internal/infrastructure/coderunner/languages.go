package coderunner

import (
	"encoding/json"
	"regexp"
	"strings"
	"unicode"

	domaincoderunner "blog-api/internal/domain/coderunner"
)

// LanguageDef 单个语言的运行定义。语言名即 Languages 注册表的 key。
type LanguageDef struct {
	// Image 容器镜像（yggdrasil 项目构建的 yggdrasil-runner-<lang>:latest，字面复用）。
	Image string
	// RunCmd 容器内执行命令（源码注入到 /code/main.<Extension>）。
	RunCmd string
	// Extension 源码文件扩展名。
	Extension string
	// DefaultLimits 默认资源限制（作者未声明 overrides 时用）。
	DefaultLimits domaincoderunner.ResourceLimits
	// AllowNetwork 该语言本身是否允许网络（与全局/作者声明取与）。
	AllowNetwork bool
}

// Languages 内置语言注册表。
//
// 新增语言在此 insert 即默认启用；若运维需收窄，设置 CODE_RUNNER_LANGUAGES
// 为逗号分隔列表（canonical key）。
//
// 镜像名与 yggdrasil docker/build-runners.sh 产出严格对应（字面复用，见 T3 #27）。
// run_cmd 对齐 yggdrasil languages.rs：
//   - python -u：强制 stdout 行刷新，避免 pipe 块缓冲导致流式输出失效
//   - go run：单条命令编译+运行；镜像已把 GOCACHE/GOTMPDIR 重定向到可写 /tmp
//   - rust：镜像内置 run-rust.sh wrapper（rustc 编译+运行两步）
//   - bun：原生 TS 运行器，单步执行
var Languages = map[string]LanguageDef{
	"python": {
		Image:     "yggdrasil-runner-python:latest",
		RunCmd:    "python -u /code/main.py",
		Extension: "py",
		DefaultLimits: domaincoderunner.ResourceLimits{
			CPUCores: 1.0, MemoryMB: 256, TimeoutSecs: 5,
			OutputBytes: 1048576, AllowNetwork: false,
		},
		AllowNetwork: false,
	},
	"node": {
		Image:     "yggdrasil-runner-node:latest",
		RunCmd:    "node /code/main.js",
		Extension: "js",
		DefaultLimits: domaincoderunner.ResourceLimits{
			CPUCores: 1.0, MemoryMB: 256, TimeoutSecs: 5,
			OutputBytes: 1048576, AllowNetwork: false,
		},
		AllowNetwork: false,
	},
	// 编译型语言：go run 内部编译+运行。只读 rootfs 下 $HOME/.cache 不可写，
	// 镜像已重定向 GOCACHE/GOTMPDIR/GOPATH 到可写 /tmp。冷启动比解释型慢，timeout 10s。
	// 内存 384MB：go 编译 fork 大量 compile/asm 子进程，256MB 会 OOM（实测不够）。
	"go": {
		Image:     "yggdrasil-runner-go:latest",
		RunCmd:    "go run /code/main.go",
		Extension: "go",
		DefaultLimits: domaincoderunner.ResourceLimits{
			CPUCores: 1.0, MemoryMB: 384, TimeoutSecs: 10,
			OutputBytes: 1048576, AllowNetwork: false,
		},
		AllowNetwork: false,
	},
	// rustc 编译+运行是两步，镜像内置 run-rust.sh wrapper（exec 替换 shell 后
	// "A && B" 后半段不执行，故需 wrapper）。rustc 内存开销大、编译慢，512MB/15s。
	"rust": {
		Image:     "yggdrasil-runner-rust:latest",
		RunCmd:    "/usr/local/bin/run-rust.sh",
		Extension: "rs",
		DefaultLimits: domaincoderunner.ResourceLimits{
			CPUCores: 1.0, MemoryMB: 512, TimeoutSecs: 15,
			OutputBytes: 1048576, AllowNetwork: false,
		},
		AllowNetwork: false,
	},
	// bun：原生 TypeScript 运行器。ts/typescript 别名归一到 bun。
	"bun": {
		Image:     "yggdrasil-runner-bun:latest",
		RunCmd:    "bun run /code/main.ts",
		Extension: "ts",
		DefaultLimits: domaincoderunner.ResourceLimits{
			CPUCores: 1.0, MemoryMB: 256, TimeoutSecs: 5,
			OutputBytes: 1048576, AllowNetwork: false,
		},
		AllowNetwork: false,
	},
}

// IsSupportedLang 判断语言是否已注册；运行时白名单由执行服务检查。
func IsSupportedLang(lang string) bool {
	_, ok := Languages[domaincoderunner.NormalizeLang(lang)]
	return ok
}

// FenceInfo 保存围栏的显示元数据和独立执行声明。
type FenceInfo struct {
	Language       string
	Runnable       bool
	Overrides      json.RawMessage
	Filename       *string
	HighlightLines string
}

var fenceLineSpec = regexp.MustCompile(`^[0-9]+(-[0-9]+)?(,[0-9]+(-[0-9]+)?)*$`)
var fenceTitle = regexp.MustCompile(`^"(?:[^"\\]|\\.)*"`)

// ParseFenceInfo 解析 title、紧凑行号范围、run/runnable 与末尾资源 JSON。
// 仅可运行围栏归一化语言；行号范围不展开，错误元数据不改变源码。
func ParseFenceInfo(info string) FenceInfo {
	rest := strings.TrimSpace(info)
	end := strings.IndexFunc(rest, unicode.IsSpace)
	if end < 0 {
		return FenceInfo{Language: rest}
	}
	result := FenceInfo{Language: rest[:end]}
	rest = strings.TrimSpace(rest[end:])
	for rest != "" {
		if strings.HasPrefix(rest, `title="`) {
			quoted := fenceTitle.FindString(rest[6:])
			if quoted == "" {
				break
			}
			var filename string
			if json.Unmarshal([]byte(quoted), &filename) == nil {
				result.Filename = &filename
			}
			rest = strings.TrimSpace(rest[6+len(quoted):])
			continue
		}
		if rest[0] == '{' {
			if end := strings.IndexByte(rest, '}'); end >= 0 {
				rows := strings.Join(strings.Fields(rest[1:end]), "")
				if fenceLineSpec.MatchString(rows) {
					result.HighlightLines = rows
					rest = strings.TrimSpace(rest[end+1:])
					continue
				}
			}
			var limits domaincoderunner.ResourceLimits
			if json.Unmarshal([]byte(rest), &limits) == nil {
				result.Overrides = json.RawMessage(rest)
			}
			break
		}
		end := strings.IndexFunc(rest, unicode.IsSpace)
		if end < 0 {
			end = len(rest)
		}
		token := rest[:end]
		if token == "run" || token == "runnable" {
			result.Runnable = true
		}
		rest = strings.TrimSpace(rest[end:])
	}
	if result.Runnable {
		result.Language = domaincoderunner.NormalizeLang(result.Language)
	}
	return result
}

// SerializeFenceInfo 将显示与执行元数据写回围栏，文件名使用 JSON 字符串转义。
func SerializeFenceInfo(info FenceInfo) string {
	tokens := []string{info.Language}
	if info.Filename != nil {
		filename, _ := json.Marshal(*info.Filename)
		tokens = append(tokens, "title="+string(filename))
	}
	if fenceLineSpec.MatchString(info.HighlightLines) {
		tokens = append(tokens, "{"+info.HighlightLines+"}")
	}
	if info.Runnable {
		tokens = append(tokens, "runnable")
	}
	if len(info.Overrides) != 0 {
		if encoded, err := json.Marshal(info.Overrides); err == nil {
			tokens = append(tokens, string(encoded))
		}
	}
	if tokens[0] == "" && len(tokens) > 1 {
		tokens[0] = "text"
	}
	return strings.Join(tokens, " ")
}
