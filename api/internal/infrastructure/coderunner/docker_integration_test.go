//go:build integration

package coderunner

import (
	"context"
	"strings"
	"testing"
	"time"

	appcoderunner "blog-api/internal/application/coderunner"
	domaincoderunner "blog-api/internal/domain/coderunner"
)

// TestDockerRunner_RunPython 端到端验证：起真实容器执行 python hello world。
//
// 需要本地 docker 可用 + yggdrasil-runner-python:latest 镜像已 load。
// 跑法：go test -tags=integration ./internal/infrastructure/coderunner/ -run TestDockerRunner_RunPython -v
func TestDockerRunner_RunPython(t *testing.T) {
	InitDockerClient("/var/run/docker.sock")
	if sharedDockerClient == nil {
		t.Skip("Docker daemon 不可用，跳过集成测试")
	}
	runner := NewDockerRunner(sharedDockerClient)

	def := Languages["python"]
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	outcome, err := runner.Run(ctx, def.Image, def.RunCmd, "print('hello from runner')", def.Extension, def.DefaultLimits)
	if err != nil {
		t.Fatalf("Run 失败: %v", err)
	}

	if outcome.ExitCode == nil || *outcome.ExitCode != 0 {
		t.Errorf("ExitCode = %v, want 0", outcome.ExitCode)
	}
	if !strings.Contains(outcome.Stdout, "hello from runner") {
		t.Errorf("Stdout = %q, 应含 'hello from runner'", outcome.Stdout)
	}
	if outcome.TimedOut {
		t.Error("不应超时")
	}
}

// TestDockerRunner_RunStream 流式验证：emit 回调应收到 stdout chunk。
func TestDockerRunner_RunStream(t *testing.T) {
	InitDockerClient("/var/run/docker.sock")
	if sharedDockerClient == nil {
		t.Skip("Docker daemon 不可用，跳过集成测试")
	}
	runner := NewDockerRunner(sharedDockerClient)

	def := Languages["python"]
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var collected []string
	outcome, err := runner.RunStream(ctx, def.Image, def.RunCmd,
		"print('stream1')\nprint('stream2')", def.Extension, def.DefaultLimits,
		func(c appcoderunner.OutputChunk) {
			if c.Type == "stdout" {
				collected = append(collected, c.Data)
			}
		})
	if err != nil {
		t.Fatalf("RunStream 失败: %v", err)
	}

	// 流式 emit 应收到内容
	if len(collected) == 0 {
		t.Error("emit 应收到 stdout chunk")
	}
	// 最终 outcome.Stdout 也应完整
	if !strings.Contains(outcome.Stdout, "stream1") {
		t.Errorf("outcome.Stdout = %q, 应含 'stream1'", outcome.Stdout)
	}
}

// TestDockerRunner_RunAllLanguages 五种语言 hello world 全验证。
func TestDockerRunner_RunAllLanguages(t *testing.T) {
	InitDockerClient("/var/run/docker.sock")
	if sharedDockerClient == nil {
		t.Skip("Docker daemon 不可用，跳过集成测试")
	}
	runner := NewDockerRunner(sharedDockerClient)

	sources := map[string]string{
		"python": "print('ok')",
		"node":   "console.log('ok')",
		"go":     "package main\nimport \"fmt\"\nfunc main(){fmt.Println(\"ok\")}",
		"rust":   "fn main(){println!(\"ok\")}",
		"bun":    "console.log(\"ok\")",
	}

	for lang, src := range sources {
		t.Run(lang, func(t *testing.T) {
			def, ok := Languages[lang]
			if !ok {
				t.Fatalf("语言 %q 不在注册表", lang)
			}
			ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
			defer cancel()

			// go/rust 编译型语言在 QEMU 模拟（amd64 on arm64）下慢，测试用更宽松的 timeout。
			// 生产 amd64 原生执行按 def.DefaultLimits.TimeoutSecs 即可。
			limits := def.DefaultLimits
			if lang == "go" || lang == "rust" {
				limits.TimeoutSecs = 60
			}

			outcome, err := runner.Run(ctx, def.Image, def.RunCmd, src, def.Extension, limits)
			if err != nil {
				t.Fatalf("Run 失败: %v", err)
			}
			if !strings.Contains(outcome.Stdout, "ok") {
				t.Errorf("%s: Stdout=%q Stderr=%q ExitCode=%v TimedOut=%v OOM=%v",
					lang, outcome.Stdout, outcome.Stderr, outcome.ExitCode, outcome.TimedOut, outcome.OOMKilled)
			}
			// 静默 domaincoderunner 未使用告警
			_ = domaincoderunner.ResourceLimits{}
		})
	}
}
