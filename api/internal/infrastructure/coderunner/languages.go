package coderunner

import (
	"encoding/json"
	"strings"

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

// langAliases 语言别名 → canonical key 映射。
//
// canonical key（python/node/go/rust/bun）不在表里——原样通过。
// js/javascript→node、rs→rust、ts/typescript→bun。大小写不敏感。
var langAliases = map[string]string{
	"js":        "node",
	"javascript": "node",
	"rs":        "rust",
	"ts":        "bun",
	"typescript": "bun",
}

// NormalizeLang 把语言标识归一化为 canonical key。
//
// 步骤：trim → lowercase → 查 langAliases，命中返回映射值，未命中返回原值。
// 保证 canonical 名与未注册字符串都能被调用方处理。
func NormalizeLang(lang string) string {
	clean := strings.ToLower(strings.TrimSpace(lang))
	if to, ok := langAliases[clean]; ok {
		return to
	}
	return clean
}

// IsSupportedLang 是否支持该语言：先 NormalizeLang 归一化，再查 Languages 注册表。
//
// 若设置了 globalAllowedLanguages（CODE_RUNNER_LANGUAGES），还需在白名单内
// （白名单用 canonical key 比较——运维写 node 而非 js）。
func IsSupportedLang(lang string) bool {
	canonical := NormalizeLang(lang)
	if _, ok := Languages[canonical]; !ok {
		return false
	}
	if globalAllowedLanguages == nil {
		return true
	}
	for _, allowed := range globalAllowedLanguages {
		if allowed == canonical {
			return true
		}
	}
	return false
}

// ParseFenceInfo 解析围栏代码块的 info string。
//
// 格式：<lang> [runnable|run] [ {<ResourceLimits JSON>} ]
// 返回 (lang, runnable, overrides)。lang 已经过 NormalizeLang 归一化。
// 未知 token 静默忽略；JSON 解析失败时 overrides 为 nil。
func ParseFenceInfo(info string) (lang string, runnable bool, overrides *domaincoderunner.ResourceLimits) {
	tokens := strings.Fields(info)
	if len(tokens) == 0 {
		return "", false, nil
	}
	lang = NormalizeLang(tokens[0])
	for _, tok := range tokens[1:] {
		if tok == "runnable" || tok == "run" {
			runnable = true
		} else if strings.HasPrefix(tok, "{") {
			var limits domaincoderunner.ResourceLimits
			if err := json.Unmarshal([]byte(tok), &limits); err == nil {
				overrides = &limits
			}
		}
	}
	return lang, runnable, overrides
}
