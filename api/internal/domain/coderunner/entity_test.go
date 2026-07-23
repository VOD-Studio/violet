package coderunner

import (
	"testing"
	"time"

	domainshared "blog-api/internal/domain/shared"
)

func createTime() time.Time { return time.Date(2026, 7, 23, 12, 0, 0, 0, time.UTC) }

func TestNewExecutionTask(t *testing.T) {
	t.Parallel()
	uid := domainshared.NewID()
	task := NewExecutionTask("python", "print('hi')", uid)

	if task.Language() != "python" {
		t.Errorf("Language = %q, want python", task.Language())
	}
	if task.Source() != "print('hi')" {
		t.Errorf("Source = %q", task.Source())
	}
	if task.UserID() != uid {
		t.Error("UserID 不匹配")
	}
	if task.Status() != StatusQueued {
		t.Errorf("初始状态应为 queued, got %q", task.Status())
	}
	if task.ID().IsZero() {
		t.Error("ID 不应为零值")
	}
	if task.Stdout() != "" || task.Stderr() != "" {
		t.Error("新任务 stdout/stderr 应为空")
	}
	if task.ExitCode() != nil {
		t.Error("新任务 ExitCode 应为 nil")
	}
}

func TestNewExecutionTask_RejectsInvalidLanguage(t *testing.T) {
	t.Parallel()
	uid := domainshared.NewID()
	task := NewExecutionTask("ruby", "x", uid)
	// domain 层不做语言校验（由 application 层拦截），但记录时保留原值。
	// 这里锁定行为：NewExecutionTask 不因无效语言 panic，值原样保留。
	if task.Language() != "ruby" {
		t.Errorf("Language = %q, want ruby (domain 不校验语言)", task.Language())
	}
}

func TestExecutionTask_MarkRunning(t *testing.T) {
	t.Parallel()
	task := NewExecutionTask("python", "x", domainshared.NewID())
	task.MarkRunning()
	if task.Status() != StatusRunning {
		t.Errorf("MarkRunning 后状态应为 running, got %q", task.Status())
	}
}

func TestExecutionTask_MarkSuccess(t *testing.T) {
	t.Parallel()
	task := NewExecutionTask("python", "x", domainshared.NewID())
	exitZero := 0
	task.MarkSuccess("hello\n", "", &exitZero, 42)

	if task.Status() != StatusSuccess {
		t.Errorf("状态应为 success, got %q", task.Status())
	}
	if task.Stdout() != "hello\n" {
		t.Errorf("Stdout = %q", task.Stdout())
	}
	if task.Stderr() != "" {
		t.Errorf("Stderr 应为空, got %q", task.Stderr())
	}
	if task.ExitCode() == nil || *task.ExitCode() != 0 {
		t.Error("ExitCode 应为 0")
	}
	if task.DurationMs() != 42 {
		t.Errorf("DurationMs = %d, want 42", task.DurationMs())
	}
}

func TestExecutionTask_MarkError(t *testing.T) {
	t.Parallel()
	task := NewExecutionTask("python", "x", domainshared.NewID())
	exitOne := 1
	task.MarkError("", "traceback", &exitOne, 100)

	if task.Status() != StatusError {
		t.Errorf("状态应为 error, got %q", task.Status())
	}
	if task.Stderr() != "traceback" {
		t.Errorf("Stderr = %q", task.Stderr())
	}
	if task.ExitCode() == nil || *task.ExitCode() != 1 {
		t.Error("ExitCode 应为 1")
	}
}

func TestExecutionTask_MarkTimeout(t *testing.T) {
	t.Parallel()
	task := NewExecutionTask("python", "while True: pass", domainshared.NewID())
	task.MarkTimeout(5000)

	if task.Status() != StatusTimeout {
		t.Errorf("状态应为 timeout, got %q", task.Status())
	}
	if task.Stderr() != "执行超时" {
		t.Errorf("Stderr 应为「执行超时」, got %q", task.Stderr())
	}
	if task.DurationMs() != 5000 {
		t.Errorf("DurationMs = %d, want 5000", task.DurationMs())
	}
}

func TestExecutionTask_MarkOomKilled(t *testing.T) {
	t.Parallel()
	task := NewExecutionTask("python", "x", domainshared.NewID())
	exitCode := 137
	task.MarkOomKilled("", "", &exitCode, 200)

	if task.Status() != StatusOomKilled {
		t.Errorf("状态应为 oom_killed, got %q", task.Status())
	}
	if task.ExitCode() == nil || *task.ExitCode() != 137 {
		t.Error("ExitCode 应为 137")
	}
}

func TestExecutionTask_MarkFailed(t *testing.T) {
	t.Parallel()
	task := NewExecutionTask("python", "x", domainshared.NewID())
	task.MarkFailed(300)

	if task.Status() != StatusFailed {
		t.Errorf("状态应为 failed, got %q", task.Status())
	}
	if task.Stderr() != "系统暂时不可用" {
		t.Errorf("系统异常 stderr 应脱敏为「系统暂时不可用」, got %q", task.Stderr())
	}
	if task.DurationMs() != 300 {
		t.Errorf("DurationMs = %d, want 300", task.DurationMs())
	}
}

func TestReconstructExecutionTask(t *testing.T) {
	t.Parallel()
	id := domainshared.NewID()
	uid := domainshared.NewID()
	exit := 0
	task := ReconstructExecutionTask(id, uid, "go", "code", StatusSuccess, "out", "err", &exit, 100, createTime())

	if task.ID() != id {
		t.Error("ID 不匹配")
	}
	if task.UserID() != uid {
		t.Error("UserID 不匹配")
	}
	if task.Status() != StatusSuccess {
		t.Errorf("Status = %q", task.Status())
	}
	if task.Stdout() != "out" || task.Stderr() != "err" {
		t.Error("Stdout/Stderr 不匹配")
	}
	if task.ExitCode() == nil || *task.ExitCode() != 0 {
		t.Error("ExitCode 不匹配")
	}
	if task.DurationMs() != 100 {
		t.Errorf("DurationMs = %d", task.DurationMs())
	}
}
