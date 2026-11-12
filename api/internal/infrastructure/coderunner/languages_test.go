package coderunner

import (
	"encoding/json"
	"testing"

	domaincoderunner "blog-api/internal/domain/coderunner"
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
	for _, tc := range []struct {
		info     string
		language string
		runnable bool
	}{
		{"python runnable", "python", true},
		{"node run", "node", true},
		{"js runnable", "node", true},
		{"typescript runnable", "bun", true},
		{"PYTHON runnable", "python", true},
		{"TypeScript", "TypeScript", false},
		{"rust", "rust", false},
		{"", "", false},
	} {
		t.Run(tc.info, func(t *testing.T) {
			t.Parallel()
			got := ParseFenceInfo(tc.info)
			if got.Language != tc.language || got.Runnable != tc.runnable || got.Overrides != nil {
				t.Fatalf("unexpected fence: %+v", got)
			}
		})
	}
	t.Run("resource declarations", func(t *testing.T) {
		t.Parallel()
		got := ParseFenceInfo(`JS title=example run {"timeout_secs": 10, "memory_mb": 512, "allow_network": true, "cpu_cores": 1.0, "output_bytes": 1024}`)
		var limits domaincoderunner.ResourceLimits
		if err := json.Unmarshal(got.Overrides, &limits); err != nil {
			t.Fatal(err)
		}
		if got.Language != "node" || !got.Runnable || limits.TimeoutSecs != 10 || limits.MemoryMB != 512 || !limits.AllowNetwork || limits.CPUCores != 1 || limits.OutputBytes != 1024 {
			t.Fatalf("resource overrides lost: %+v / %+v", got, limits)
		}
	})
	t.Run("JSON values are not runnable flags", func(t *testing.T) {
		t.Parallel()
		got := ParseFenceInfo(`python {"description": "run runnable", "timeout_secs": 5}`)
		if got.Runnable || got.Overrides == nil {
			t.Fatalf("unexpected fence: %+v", got)
		}
	})
	t.Run("invalid JSON has no partial overrides", func(t *testing.T) {
		t.Parallel()
		for _, info := range []string{
			`python runnable {"timeout_secs": 10,}`,
			`python runnable {"timeout_secs": "10"}`,
			`python runnable {"timeout_secs": 10} trailing`,
			`python runnable {not valid json}`,
		} {
			got := ParseFenceInfo(info)
			if !got.Runnable || got.Overrides != nil {
				t.Fatalf("%q: unexpected fence %+v", info, got)
			}
		}
	})
	t.Run("metadata remains compact and survives serialization", func(t *testing.T) {
		t.Parallel()
		filename := "src/a \"quoted\" <file> & `tick`.ts"
		for _, runnable := range []bool{false, true} {
			input := FenceInfo{
				Language:       "typescript",
				Runnable:       runnable,
				Filename:       &filename,
				HighlightLines: "1,3-999999999999999999999999999999999999",
				Overrides:      json.RawMessage(`{"timeout_secs":10,"allow_network":false}`),
			}
			got := ParseFenceInfo(SerializeFenceInfo(input))
			expectedLanguage := "typescript"
			if runnable {
				expectedLanguage = "bun"
			}
			if got.Language != expectedLanguage || got.Runnable != runnable || got.Filename == nil || *got.Filename != filename || got.HighlightLines != input.HighlightLines || string(got.Overrides) != string(input.Overrides) {
				t.Fatalf("metadata roundtrip lost: %+v", got)
			}
		}
	})
	t.Run("title contents are not flags or resources", func(t *testing.T) {
		t.Parallel()
		got := ParseFenceInfo(`python title="run {1,3} \"runnable\"" { 1, 3-5 } run {"timeout_secs":10}`)
		if got.Filename == nil || *got.Filename != `run {1,3} "runnable"` || got.HighlightLines != "1,3-5" || !got.Runnable || got.Overrides == nil {
			t.Fatalf("unexpected fence: %+v", got)
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
