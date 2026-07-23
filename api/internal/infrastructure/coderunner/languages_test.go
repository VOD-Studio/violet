package coderunner

import (
	"testing"

	domaincoderunner "blog-api/internal/domain/coderunner"
)

func TestNormalizeLang(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"canonical python 原样通过", "python", "python"},
		{"canonical node 原样通过", "node", "node"},
		{"canonical go 原样通过", "go", "go"},
		{"canonical rust 原样通过", "rust", "rust"},
		{"canonical bun 原样通过", "bun", "bun"},
		{"js → node", "js", "node"},
		{"javascript → node", "javascript", "node"},
		{"rs → rust", "rs", "rust"},
		{"ts → bun", "ts", "bun"},
		{"typescript → bun", "typescript", "bun"},
		{"大小写不敏感", "JavaScript", "node"},
		{"首尾空白容忍", "  JS  ", "node"},
		{"tab 空白容忍", "\tRS\t", "rust"},
		{"未注册语言原样返回", "ruby", "ruby"},
		{"空串原样返回", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := NormalizeLang(tc.input); got != tc.want {
				t.Errorf("NormalizeLang(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

func TestIsSupportedLang(t *testing.T) {
	t.Parallel()
	// 默认无白名单收窄：注册表里的语言全部放行
	supported := []string{"python", "node", "go", "rust", "bun", "js", "javascript", "rs", "ts", "typescript", "Python", "  RUST  "}
	for _, lang := range supported {
		if !IsSupportedLang(lang) {
			t.Errorf("IsSupportedLang(%q) 应为 true", lang)
		}
	}
	unsupported := []string{"ruby", "c", "bash", "python2", "", "python; rm -rf /"}
	for _, lang := range unsupported {
		if IsSupportedLang(lang) {
			t.Errorf("IsSupportedLang(%q) 应为 false", lang)
		}
	}
}

func TestIsSupportedLang_Whitelist(t *testing.T) {
	// 白名单收窄：仅 python/node 放行
	save := globalAllowedLanguages
	globalAllowedLanguages = []string{"python", "node"}
	defer func() { globalAllowedLanguages = save }()

	if !IsSupportedLang("python") {
		t.Error("白名单内 python 应放行")
	}
	if !IsSupportedLang("node") {
		t.Error("白名单内 node 应放行")
	}
	if IsSupportedLang("go") {
		t.Error("白名单外 go 应拒绝")
	}
	if IsSupportedLang("rust") {
		t.Error("白名单外 rust 应拒绝")
	}
}

func TestParseFenceInfo(t *testing.T) {
	t.Parallel()
	t.Run("runnable 标记", func(t *testing.T) {
		t.Parallel()
		lang, runnable, overrides := ParseFenceInfo("python runnable")
		if lang != "python" || !runnable || overrides != nil {
			t.Errorf("got lang=%q runnable=%v overrides=%v", lang, runnable, overrides)
		}
	})
	t.Run("run 别名标记", func(t *testing.T) {
		t.Parallel()
		lang, runnable, _ := ParseFenceInfo("node run")
		if lang != "node" || !runnable {
			t.Errorf("got lang=%q runnable=%v", lang, runnable)
		}
	})
	t.Run("带 overrides JSON", func(t *testing.T) {
		t.Parallel()
		info := `node runnable {"timeout_secs":10,"memory_mb":512,"allow_network":true,"cpu_cores":1.0,"output_bytes":1024}`
		lang, runnable, overrides := ParseFenceInfo(info)
		if lang != "node" || !runnable {
			t.Errorf("got lang=%q runnable=%v", lang, runnable)
		}
		if overrides == nil {
			t.Fatal("overrides 不应为 nil")
		}
		if overrides.TimeoutSecs != 10 || overrides.MemoryMB != 512 || !overrides.AllowNetwork {
			t.Errorf("overrides 解析错误: %+v", overrides)
		}
	})
	t.Run("别名归一为 canonical", func(t *testing.T) {
		t.Parallel()
		lang, runnable, _ := ParseFenceInfo("js runnable")
		if lang != "node" || !runnable {
			t.Errorf("js 应归一为 node, got lang=%q runnable=%v", lang, runnable)
		}
		lang, _, _ = ParseFenceInfo("typescript runnable")
		if lang != "bun" {
			t.Errorf("typescript 应归一为 bun, got %q", lang)
		}
	})
	t.Run("非 runnable 块", func(t *testing.T) {
		t.Parallel()
		lang, runnable, _ := ParseFenceInfo("rust")
		if lang != "rust" || runnable {
			t.Errorf("got lang=%q runnable=%v", lang, runnable)
		}
	})
	t.Run("空串", func(t *testing.T) {
		t.Parallel()
		lang, runnable, overrides := ParseFenceInfo("")
		if lang != "" || runnable || overrides != nil {
			t.Errorf("空串应返回空值, got lang=%q runnable=%v", lang, runnable)
		}
	})
	t.Run("大小写不敏感语言", func(t *testing.T) {
		t.Parallel()
		lang, _, _ := ParseFenceInfo("PYTHON runnable")
		if lang != "python" {
			t.Errorf("PYTHON 应归一为 python, got %q", lang)
		}
	})
	t.Run("malformed JSON yields nil", func(t *testing.T) {
		t.Parallel()
		_, runnable, overrides := ParseFenceInfo("python runnable {not valid json}")
		if !runnable {
			t.Error("runnable 标记应仍识别")
		}
		if overrides != nil {
			t.Error("malformed JSON 的 overrides 应为 nil")
		}
	})
}

func TestLanguages_Registry(t *testing.T) {
	t.Parallel()
	for _, lang := range []string{"python", "node", "go", "rust", "bun"} {
		def, ok := Languages[lang]
		if !ok {
			t.Errorf("Languages 注册表缺少 %q", lang)
			continue
		}
		if def.Image == "" {
			t.Errorf("%q 的 Image 为空", lang)
		}
		if def.RunCmd == "" {
			t.Errorf("%q 的 RunCmd 为空", lang)
		}
		if def.Extension == "" {
			t.Errorf("%q 的 Extension 为空", lang)
		}
		// 镜像名应为 yggdrasil-runner-<lang>:latest
		wantImage := "yggdrasil-runner-" + lang + ":latest"
		if def.Image != wantImage {
			t.Errorf("%q Image = %q, want %q", lang, def.Image, wantImage)
		}
	}
}

func TestClampLimits(t *testing.T) {
	t.Parallel()
	save := globalMaxLimits
	globalMaxLimits = maxLimitsSnapshot{
		MaxCPUCores:    2.0,
		MaxMemoryMB:    1024,
		MaxTimeoutSecs: 30,
		MaxOutputBytes: 1048576,
		AllowNetwork:   false,
	}
	defer func() { globalMaxLimits = save }()

	t.Run("超出上限被钳制", func(t *testing.T) {
		t.Parallel()
		raw := domaincoderunner.ResourceLimits{
			CPUCores:     5.0,
			MemoryMB:     4096,
			TimeoutSecs:  120,
			OutputBytes:  9999999,
			AllowNetwork: true,
		}
		clamped := ClampLimits(raw, true)
		if clamped.CPUCores > 2.0 {
			t.Errorf("CPUCores = %v, 应 <= 2.0", clamped.CPUCores)
		}
		if clamped.MemoryMB > 1024 {
			t.Errorf("MemoryMB = %v, 应 <= 1024", clamped.MemoryMB)
		}
		if clamped.TimeoutSecs > 30 {
			t.Errorf("TimeoutSecs = %v, 应 <= 30", clamped.TimeoutSecs)
		}
		if clamped.OutputBytes > 1048576 {
			t.Errorf("OutputBytes = %v, 应 <= 1048576", clamped.OutputBytes)
		}
		if clamped.AllowNetwork {
			t.Error("全局 AllowNetwork=false 时应被钳为 false")
		}
	})

	t.Run("allow_network 三者取与", func(t *testing.T) {
		t.Parallel()
		// 全局关 → 无论作者/语言如何都 false
		clamped := ClampLimits(domaincoderunner.ResourceLimits{AllowNetwork: true}, true)
		if clamped.AllowNetwork {
			t.Error("全局关时应 false")
		}
	})

	t.Run("allow_network 语言不允许时 false", func(t *testing.T) {
		t.Parallel()
		// 语言不允许网络（langAllowsNetwork=false）→ 即使作者声明也 false
		save2 := globalMaxLimits.AllowNetwork
		globalMaxLimits.AllowNetwork = true
		defer func() { globalMaxLimits.AllowNetwork = save2 }()
		clamped := ClampLimits(domaincoderunner.ResourceLimits{AllowNetwork: true}, false)
		if clamped.AllowNetwork {
			t.Error("语言不允许时应 false")
		}
	})
}

func TestClampLimits_Safeguarded(t *testing.T) {
	// 配置上限极低时的边界保护（min 下限）
	t.Parallel()
	save := globalMaxLimits
	globalMaxLimits = maxLimitsSnapshot{
		MaxCPUCores:    0.05,
		MaxMemoryMB:    8,
		MaxTimeoutSecs: 1,
		MaxOutputBytes: 100,
		AllowNetwork:   true,
	}
	defer func() { globalMaxLimits = save }()

	raw := domaincoderunner.ResourceLimits{
		CPUCores:     1.0,
		MemoryMB:     64,
		TimeoutSecs:  10,
		OutputBytes:  50,
		AllowNetwork: true,
	}
	clamped := ClampLimits(raw, true)
	if clamped.CPUCores != 0.05 {
		t.Errorf("CPUCores = %v, want 0.05", clamped.CPUCores)
	}
	if clamped.MemoryMB != 8 {
		t.Errorf("MemoryMB = %v, want 8", clamped.MemoryMB)
	}
	if clamped.TimeoutSecs != 1 {
		t.Errorf("TimeoutSecs = %v, want 1", clamped.TimeoutSecs)
	}
	if clamped.OutputBytes != 50 {
		t.Errorf("OutputBytes = %v, want 50", clamped.OutputBytes)
	}
	if !clamped.AllowNetwork {
		t.Error("三者皆真时应 true")
	}
}
