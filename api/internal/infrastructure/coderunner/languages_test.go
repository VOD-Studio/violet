package coderunner

import (
	"testing"
)

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
	t.Run("spaced JSON and unknown metadata", func(t *testing.T) {
		t.Parallel()
		lang, runnable, overrides := ParseFenceInfo(`JS title=example run {"timeout_secs": 10, "memory_mb": 64, "allow_network": true}`)
		if lang != "node" || !runnable || overrides == nil {
			t.Fatalf("got lang=%q runnable=%v overrides=%v", lang, runnable, overrides)
		}
		if overrides.TimeoutSecs != 10 || overrides.MemoryMB != 64 || !overrides.AllowNetwork {
			t.Errorf("spaced overrides lost: %+v", overrides)
		}
	})
	t.Run("JSON values are not runnable flags", func(t *testing.T) {
		t.Parallel()
		_, runnable, overrides := ParseFenceInfo(`python {"description": "run runnable", "timeout_secs": 5}`)
		if runnable || overrides == nil || overrides.TimeoutSecs != 5 {
			t.Errorf("got runnable=%v overrides=%v", runnable, overrides)
		}
	})
	t.Run("invalid JSON does not apply partial overrides", func(t *testing.T) {
		t.Parallel()
		for _, info := range []string{
			`python runnable {"timeout_secs": 10,}`,
			`python runnable {"timeout_secs": "10"}`,
			`python runnable {"timeout_secs": 10} trailing`,
		} {
			_, runnable, overrides := ParseFenceInfo(info)
			if !runnable || overrides != nil {
				t.Errorf("%q: got runnable=%v overrides=%v", info, runnable, overrides)
			}
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
