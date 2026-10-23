package coderunner

import (
	"context"
	"math"
	"testing"
	"time"

	domaincoderunner "blog-api/internal/domain/coderunner"
	domainsettings "blog-api/internal/domain/settings"
	domainshared "blog-api/internal/domain/shared"
)

type controlledRunner struct {
	started chan domaincoderunner.ResourceLimits
	release chan struct{}
}

func (r *controlledRunner) Available() error { return nil }
func (r *controlledRunner) Run(ctx context.Context, image, cmd, source, ext string, limits domaincoderunner.ResourceLimits) (RunOutcome, error) {
	r.started <- limits
	select {
	case <-r.release:
	case <-ctx.Done():
		return RunOutcome{}, ctx.Err()
	}
	zero := 0
	return RunOutcome{ExitCode: &zero}, nil
}
func (r *controlledRunner) RunStream(ctx context.Context, image, cmd, source, ext string, limits domaincoderunner.ResourceLimits, emit func(OutputChunk)) (RunOutcome, error) {
	return r.Run(ctx, image, cmd, source, ext, limits)
}

func controlledService(t *testing.T, concurrent int) (*Service, *testPolicies, *controlledRunner) {
	t.Helper()
	policy := defaultTestPolicy()
	policy.MaxConcurrent = concurrent
	provider := &testPolicies{value: policy}
	runner := &controlledRunner{started: make(chan domaincoderunner.ResourceLimits, 16), release: make(chan struct{}, 16)}
	t.Cleanup(func() { close(runner.release) })
	return NewService(newFakeRepo(), runner, newFakeSink(), testResolver{}, provider), provider, runner
}

func submitTask(t *testing.T, svc *Service, stream bool) string {
	t.Helper()
	req := ExecRequest{Language: "python", Source: "print(1)"}
	var id string
	var err error
	if stream {
		id, err = svc.StartExecStream(context.Background(), req, domainshared.NewID())
	} else {
		id, err = svc.StartExec(context.Background(), req, domainshared.NewID())
	}
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func nextRun(t *testing.T, runner *controlledRunner) domaincoderunner.ResourceLimits {
	t.Helper()
	select {
	case limits := <-runner.started:
		return limits
	case <-time.After(2 * time.Second):
		t.Fatal("任务未获得执行名额")
		return domaincoderunner.ResourceLimits{}
	}
}

func noRun(t *testing.T, runner *controlledRunner) {
	t.Helper()
	select {
	case <-runner.started:
		t.Fatal("超出动态并发上限启动任务")
	case <-time.After(120 * time.Millisecond):
	}
}

func TestPolicyConcurrencyShrinkAndGrow(t *testing.T) {
	svc, provider, runner := controlledService(t, 2)
	a := submitTask(t, svc, false)
	nextRun(t, runner)
	b := submitTask(t, svc, true)
	nextRun(t, runner)
	provider.update(func(p *domainsettings.CodeRunnerPolicy) { p.MaxConcurrent = 1 })
	c := submitTask(t, svc, false)
	noRun(t, runner)
	runner.release <- struct{}{}
	noRun(t, runner)
	runner.release <- struct{}{}
	nextRun(t, runner)
	waitForStatus(t, svc, a, domaincoderunner.StatusSuccess, time.Second)
	waitForStatus(t, svc, b, domaincoderunner.StatusSuccess, time.Second)
	d := submitTask(t, svc, true)
	noRun(t, runner)
	provider.update(func(p *domainsettings.CodeRunnerPolicy) { p.MaxConcurrent = 2 })
	nextRun(t, runner)
	e := submitTask(t, svc, false)
	noRun(t, runner)
	runner.release <- struct{}{}
	nextRun(t, runner)
	runner.release <- struct{}{}
	runner.release <- struct{}{}
	for _, id := range []string{c, d, e} {
		waitForStatus(t, svc, id, domaincoderunner.StatusSuccess, time.Second)
	}
}

func TestQueuedTasksRecheckPolicyBothPaths(t *testing.T) {
	cases := []struct {
		name    string
		change  func(*domainsettings.CodeRunnerPolicy)
		message string
	}{
		{"禁用", func(p *domainsettings.CodeRunnerPolicy) { p.Enabled = false }, "代码运行器已被禁用"},
		{"语言", func(p *domainsettings.CodeRunnerPolicy) { p.Languages = []string{"node"} }, "不支持该执行语言"},
		{"源码", func(p *domainsettings.CodeRunnerPolicy) { p.MaxSourceBytes = 1 }, "源代码过大"},
	}
	for _, stream := range []bool{false, true} {
		for _, tc := range cases {
			t.Run(tc.name+map[bool]string{false: "轮询", true: "流式"}[stream], func(t *testing.T) {
				svc, provider, runner := controlledService(t, 1)
				first := submitTask(t, svc, false)
				nextRun(t, runner)
				queued := submitTask(t, svc, stream)
				provider.update(tc.change)
				runner.release <- struct{}{}
				waitForStatus(t, svc, first, domaincoderunner.StatusSuccess, time.Second)
				waitForStatus(t, svc, queued, domaincoderunner.StatusFailed, time.Second)
				result, err := svc.GetExecResult(context.Background(), queued)
				if err != nil || result.Stderr != tc.message {
					t.Fatalf("拒绝原因=%q, err=%v", result.Stderr, err)
				}
				noRun(t, runner)
			})
		}
	}
}

func TestQueuedTaskUsesTightenedResourcesAndOriginalRetention(t *testing.T) {
	svc, provider, runner := controlledService(t, 1)
	submitTask(t, svc, false)
	nextRun(t, runner)
	queued := submitTask(t, svc, true)
	provider.update(func(p *domainsettings.CodeRunnerPolicy) {
		p.MaxCPUCores = 0.5
		p.MaxMemoryMB = 64
		p.MaxTimeoutSecs = 2
		p.MaxOutputBytes = 10
		p.TaskTTLSecs = 1
	})
	runner.release <- struct{}{}
	limits := nextRun(t, runner)
	if limits.CPUCores != 0.5 || limits.MemoryMB != 64 || limits.TimeoutSecs != 2 || limits.OutputBytes != 10 {
		t.Fatalf("未应用收紧后的资源上限: %+v", limits)
	}
	runner.release <- struct{}{}
	waitForStatus(t, svc, queued, domaincoderunner.StatusSuccess, time.Second)
	task, err := svc.repo.Get(context.Background(), mustParseID(queued))
	if err != nil || task.RetentionTTL() != 300*time.Second {
		t.Fatalf("已有任务保留期被修改: %v, %v", task, err)
	}
}

func TestQueueTimeoutHasExplicitResult(t *testing.T) {
	for _, stream := range []bool{false, true} {
		svc, provider, runner := controlledService(t, 1)
		provider.update(func(p *domainsettings.CodeRunnerPolicy) { p.QueueTimeoutSecs = 1 })
		first := submitTask(t, svc, false)
		nextRun(t, runner)
		queued := submitTask(t, svc, stream)
		waitForStatus(t, svc, queued, domaincoderunner.StatusFailed, 2*time.Second)
		result, err := svc.GetExecResult(context.Background(), queued)
		if err != nil || result.Stderr != "排队超时" {
			t.Fatalf("排队超时未区分: %+v, %v", result, err)
		}
		runner.release <- struct{}{}
		waitForStatus(t, svc, first, domaincoderunner.StatusSuccess, time.Second)
		noRun(t, runner)
	}
}

func TestBothPathsRejectUnavailablePolicyAndDisabledLanguages(t *testing.T) {
	for _, stream := range []bool{false, true} {
		for _, kind := range []string{"禁用", "空语言", "配置读取故障"} {
			svc, provider, _ := controlledService(t, 1)
			switch kind {
			case "禁用":
				provider.value.Enabled = false
			case "空语言":
				provider.value.Languages = []string{}
			case "配置读取故障":
				provider.err = errFake("配置读取失败")
			}
			req := ExecRequest{Language: "python", Source: "x"}
			var err error
			if stream {
				_, err = svc.StartExecStream(context.Background(), req, domainshared.NewID())
			} else {
				_, err = svc.StartExec(context.Background(), req, domainshared.NewID())
			}
			if err == nil {
				t.Fatalf("%s未拒绝stream=%v", kind, stream)
			}
		}
	}
}

func TestClampLimitsResourceBoundsAndNetworkPermissions(t *testing.T) {
	policy := defaultTestPolicy()
	limits := clampLimits(domaincoderunner.ResourceLimits{CPUCores: 50, MemoryMB: 50000, TimeoutSecs: 999, OutputBytes: 9999999}, true, policy)
	if limits.CPUCores != policy.MaxCPUCores || limits.MemoryMB != policy.MaxMemoryMB || limits.TimeoutSecs != policy.MaxTimeoutSecs || limits.OutputBytes != policy.MaxOutputBytes {
		t.Fatalf("未钳制上限: %+v", limits)
	}
	for _, cpu := range []float64{0, -1, math.NaN(), math.Inf(1)} {
		limits = clampLimits(domaincoderunner.ResourceLimits{CPUCores: cpu}, false, policy)
		if limits.CPUCores != 0.1 || limits.MemoryMB != 16 || limits.TimeoutSecs != 1 || limits.OutputBytes != 1 {
			t.Fatalf("未钳制下限: %+v", limits)
		}
	}
	for _, author := range []bool{false, true} {
		for _, language := range []bool{false, true} {
			for _, global := range []bool{false, true} {
				policy.AllowNetwork = global
				limits = clampLimits(domaincoderunner.ResourceLimits{AllowNetwork: author}, language, policy)
				if limits.AllowNetwork != (author && language && global) {
					t.Fatal("联网未遵守三重许可")
				}
			}
		}
	}
}
