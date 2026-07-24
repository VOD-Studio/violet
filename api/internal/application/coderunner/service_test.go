package coderunner

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	domaincoderunner "blog-api/internal/domain/coderunner"
	domainshared "blog-api/internal/domain/shared"
)

// fakeRunner 测试用 SandboxRunner。
type fakeRunner struct {
	mu        sync.Mutex
	called    int
	stdout    string
	stderr    string
	exitCode  *int
	oomKilled bool
	timedOut  bool
	err       error
	streams   []OutputChunk // RunStream 收到的 emit
	available bool          // Available() 返回值；默认 false，测试按需置 true
}

func (f *fakeRunner) Available() error {
	if !f.available {
		return errFake("执行器不可用")
	}
	return nil
}

func (f *fakeRunner) Run(ctx context.Context, image, cmd, source, ext string, limits domaincoderunner.ResourceLimits) (RunOutcome, error) {
	f.mu.Lock()
	f.called++
	f.mu.Unlock()
	if f.err != nil {
		return RunOutcome{TimedOut: f.timedOut}, f.err
	}
	return RunOutcome{
		ExitCode:  f.exitCode,
		Stdout:    f.stdout,
		Stderr:    f.stderr,
		OOMKilled: f.oomKilled,
		TimedOut:  f.timedOut,
	}, nil
}

func (f *fakeRunner) RunStream(ctx context.Context, image, cmd, source, ext string, limits domaincoderunner.ResourceLimits, emit func(OutputChunk)) (RunOutcome, error) {
	f.mu.Lock()
	f.called++
	f.mu.Unlock()
	// 模拟流式输出
	emit(OutputChunk{Type: "stdout", Data: f.stdout})
	if f.stderr != "" {
		emit(OutputChunk{Type: "stderr", Data: f.stderr})
	}
	f.streams = append(f.streams, OutputChunk{Type: "stdout", Data: f.stdout})
	if f.err != nil {
		return RunOutcome{TimedOut: f.timedOut}, f.err
	}
	return RunOutcome{
		ExitCode:  f.exitCode,
		Stdout:    f.stdout,
		Stderr:    f.stderr,
		OOMKilled: f.oomKilled,
		TimedOut:  f.timedOut,
	}, nil
}

// fakeRepo 测试用 TaskRepository。
type fakeRepo struct {
	mu    sync.Mutex
	data  map[string]*domaincoderunner.ExecutionTask
	calls int
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{data: make(map[string]*domaincoderunner.ExecutionTask)}
}

func (r *fakeRepo) Save(ctx context.Context, task *domaincoderunner.ExecutionTask) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.calls++
	r.data[task.ID().String()] = task
	return nil
}

func (r *fakeRepo) Get(ctx context.Context, id domainshared.ID) (*domaincoderunner.ExecutionTask, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if t, ok := r.data[id.String()]; ok {
		return t, nil
	}
	return nil, domaincoderunner.ErrTaskNotFound
}

func (r *fakeRepo) DeleteExpired(ctx context.Context) error { return nil }

// fakeSink 测试用 StreamSink + StreamConsumer。
type fakeSink struct {
	mu       sync.Mutex
	channels map[string]chan OutputChunk
}

func newFakeSink() *fakeSink {
	return &fakeSink{channels: make(map[string]chan OutputChunk)}
}

func (s *fakeSink) Insert(taskID string) chan OutputChunk {
	ch := make(chan OutputChunk, 64)
	s.mu.Lock()
	s.channels[taskID] = ch
	s.mu.Unlock()
	return ch
}

func (s *fakeSink) Take(taskID string) chan OutputChunk {
	s.mu.Lock()
	defer s.mu.Unlock()
	if ch, ok := s.channels[taskID]; ok {
		delete(s.channels, taskID)
		return ch
	}
	return nil
}

// testResolver 测试用 LangResolver。
type testResolver struct{}

func (testResolver) Normalize(lang string) string { return lang }
func (testResolver) Resolve(langKey string) (string, string, string, domaincoderunner.ResourceLimits, bool, bool) {
	return "img:" + langKey, "run " + langKey, "py", domaincoderunner.ResourceLimits{
		CPUCores: 1, MemoryMB: 256, TimeoutSecs: 5, OutputBytes: 1024,
	}, false, true
}

func newTestService(t *testing.T, runner RunnerAlias) (*Service, *fakeRepo, *fakeSink) {
	t.Helper()
	repo := newFakeRepo()
	sink := newFakeSink()
	cfg := Config{MaxSourceBytes: 1024, MaxConcurrent: 2, QueueTimeoutSecs: 5, TaskTTLSecs: 300}
	svc := NewService(repo, runner, sink, testResolver{}, cfg)
	return svc, repo, sink
}

func TestService_StartExec_InvalidLanguage(t *testing.T) {
	t.Parallel()
	svc, repo, _ := newTestService(t, &fakeRunner{})
	_, err := svc.StartExec(context.Background(), ExecRequest{Language: "ruby", Source: "x"}, domainshared.NewID())
	if err == nil {
		t.Fatal("应返回语言不支持错误")
	}
	if repo.calls != 0 {
		t.Error("校验失败不应保存任务")
	}
}

func TestService_StartExec_SourceTooLarge(t *testing.T) {
	t.Parallel()
	svc, _, _ := newTestService(t, &fakeRunner{available: true})
	big := string(make([]byte, 2048))
	_, err := svc.StartExec(context.Background(), ExecRequest{Language: "python", Source: big}, domainshared.NewID())
	if err == nil {
		t.Fatal("应返回源码过大错误")
	}
}

func TestService_StartExec_RunnerUnavailable(t *testing.T) {
	// 执行器不可用（available=false）→ validate 前置拒绝，错误信息直达前端。
	// 模拟「功能未启用」或「daemon 连接失败」场景，不应等到后台执行才报。
	t.Parallel()
	svc, repo, _ := newTestService(t, &fakeRunner{available: false})
	_, err := svc.StartExec(context.Background(), ExecRequest{Language: "python", Source: "print(1)"}, domainshared.NewID())
	if err == nil {
		t.Fatal("执行器不可用时应返回错误")
	}
	// 错误信息应含「执行器不可用」（来自 fakeRunner.Available），而非脱敏的「系统暂时不可用」
	if !strings.Contains(err.Error(), "执行器不可用") {
		t.Errorf("错误应含「执行器不可用」, got %q", err.Error())
	}
	// 不应创建任务（前置拦截）
	if repo.calls != 0 {
		t.Errorf("前置拦截不应保存任务, calls=%d", repo.calls)
	}
}

func TestService_StartExec_Success(t *testing.T) {
	t.Parallel()
	exitZero := 0
	runner := &fakeRunner{available: true, stdout: "hello", exitCode: &exitZero}
	svc, repo, _ := newTestService(t, runner)

	taskID, err := svc.StartExec(context.Background(), ExecRequest{Language: "python", Source: "print('hello')"}, domainshared.NewID())
	if err != nil {
		t.Fatalf("StartExec 失败: %v", err)
	}

	// 等后台执行完成
	waitForStatus(t, svc, taskID, domaincoderunner.StatusSuccess, 2*time.Second)

	task, _ := repo.Get(context.Background(), mustParseID(taskID))
	if task.Stdout() != "hello" {
		t.Errorf("Stdout = %q, want hello", task.Stdout())
	}
	if task.Status() != domaincoderunner.StatusSuccess {
		t.Errorf("Status = %q", task.Status())
	}
}

func TestService_StartExec_Error(t *testing.T) {
	t.Parallel()
	exitOne := 1
	runner := &fakeRunner{available: true, stderr: "traceback", exitCode: &exitOne}
	svc, repo, _ := newTestService(t, runner)

	taskID, _ := svc.StartExec(context.Background(), ExecRequest{Language: "node", Source: "throw 1"}, domainshared.NewID())
	waitForStatus(t, svc, taskID, domaincoderunner.StatusError, 2*time.Second)

	task, _ := repo.Get(context.Background(), mustParseID(taskID))
	if task.Status() != domaincoderunner.StatusError {
		t.Errorf("Status = %q, want error", task.Status())
	}
	if task.Stderr() != "traceback" {
		t.Errorf("Stderr = %q", task.Stderr())
	}
}

func TestService_StartExec_Failed(t *testing.T) {
	t.Parallel()
	runner := &fakeRunner{available: true, err: errFake("daemon down")}
	svc, repo, _ := newTestService(t, runner)

	taskID, _ := svc.StartExec(context.Background(), ExecRequest{Language: "python", Source: "x"}, domainshared.NewID())
	waitForStatus(t, svc, taskID, domaincoderunner.StatusFailed, 2*time.Second)

	task, _ := repo.Get(context.Background(), mustParseID(taskID))
	if task.Status() != domaincoderunner.StatusFailed {
		t.Errorf("Status = %q, want failed", task.Status())
	}
	if task.Stderr() != "系统暂时不可用" {
		t.Errorf("脱敏文案应为「系统暂时不可用」, got %q", task.Stderr())
	}
}

func TestService_StartExec_Timeout(t *testing.T) {
	t.Parallel()
	runner := &fakeRunner{available: true, timedOut: true}
	svc, repo, _ := newTestService(t, runner)

	taskID, _ := svc.StartExec(context.Background(), ExecRequest{Language: "python", Source: "while True: pass"}, domainshared.NewID())
	waitForStatus(t, svc, taskID, domaincoderunner.StatusTimeout, 2*time.Second)

	task, _ := repo.Get(context.Background(), mustParseID(taskID))
	if task.Status() != domaincoderunner.StatusTimeout {
		t.Errorf("Status = %q, want timeout", task.Status())
	}
}

func TestService_StartExecStream_DoneChunkPushed(t *testing.T) {
	t.Parallel()
	exitZero := 0
	runner := &fakeRunner{available: true, stdout: "stream-out", exitCode: &exitZero}
	svc, repo, _ := newTestService(t, runner)

	taskID, _ := svc.StartExecStream(context.Background(), ExecRequest{Language: "python", Source: "print(1)"}, domainshared.NewID())
	waitForStatus(t, svc, taskID, domaincoderunner.StatusSuccess, 2*time.Second)

	// 流式路径也会更新 repo（轮询兜底）
	task, _ := repo.Get(context.Background(), mustParseID(taskID))
	if task.Status() != domaincoderunner.StatusSuccess {
		t.Errorf("流式路径 repo 状态 = %q, want success", task.Status())
	}
}

func TestService_ConsumeStream(t *testing.T) {
	t.Parallel()
	svc, _, sink := newTestService(t, &fakeRunner{})

	// 手动 Insert 一个（模拟 StartExecStream 的行为）
	sink.Insert("task-x")
	ch := svc.ConsumeStream("task-x")
	if ch == nil {
		t.Fatal("ConsumeStream 应返回 Insert 的 channel")
	}
	// 二次消费返回 nil
	if svc.ConsumeStream("task-x") != nil {
		t.Error("二次 ConsumeStream 应返回 nil")
	}
}

func TestService_GetExecResult_NotFound(t *testing.T) {
	t.Parallel()
	svc, _, _ := newTestService(t, &fakeRunner{})
	_, err := svc.GetExecResult(context.Background(), "00000000-0000-0000-0000-000000000000")
	if err == nil {
		t.Error("不存在的 task 应返回错误")
	}
}

// waitForStatus 轮询直到任务到达终态或超时。
func waitForStatus(t *testing.T, svc *Service, taskID string, wantStatus string, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		task, err := svc.GetExecResult(context.Background(), taskID)
		if err == nil && domaincoderunner.IsTerminalStatus(task.Status) {
			if task.Status != wantStatus {
				t.Errorf("status = %q, want %q", task.Status, wantStatus)
			}
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("等待 status=%q 超时", wantStatus)
}

func mustParseID(s string) domainshared.ID {
	id, _ := domainshared.ParseID(s)
	return id
}

type errFake string

func (e errFake) Error() string { return string(e) }
