package coderunner

import (
	"context"
	"fmt"
	"math"
	"slices"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	domaincoderunner "blog-api/internal/domain/coderunner"
	domainsettings "blog-api/internal/domain/settings"
	domainshared "blog-api/internal/domain/shared"
)

// PolicyProvider 提供当前实例的有效运行策略及读取故障。
type PolicyProvider interface {
	CodeRunner() (domainsettings.CodeRunnerPolicy, uint64)
	CodeRunnerError() error
}

// StreamSink 流式输出的 channel 生产者接口（StreamRegistry 实现之）。
// service 只依赖此窄接口，不直接依赖 infrastructure 的 StreamRegistry 具体类型。
type StreamSink interface {
	Insert(taskID string, ttl time.Duration) chan OutputChunk
	Complete(taskID string, ttl time.Duration)
}

// StreamConsumer SSE handler 取走 channel 的接口（StreamRegistry 实现之）。
type StreamConsumer interface {
	Take(taskID string) chan OutputChunk
}

// LangResolver 语言定义解析端口。
//
// 解耦 application 与 infrastructure：service 通过此接口取语言镜像/命令/默认限制，
// 而非直接 import infrastructure 的 Languages 包级变量。infrastructure 提供
// 默认实现（defaultLangResolver），container 注入。
type LangResolver interface {
	// Resolve 返回语言的镜像、运行命令、扩展名、默认限制、是否允许网络。
	// 语言不存在返回 false。
	Resolve(langKey string) (image, cmd, ext string, defaultLimits domaincoderunner.ResourceLimits, allowNetwork bool, ok bool)
	// Normalize 别名归一化（js→node 等）。
	Normalize(lang string) string
}

// Service 两条执行路径共用策略校验、动态准入与沙箱执行。
type Service struct {
	repo     domaincoderunner.TaskRepository
	runner   SandboxRunner
	sink     StreamSink
	resolver LangResolver
	policies PolicyProvider
	mu       sync.Mutex
	active   int
	changed  chan struct{}
}

// NewService 构造执行服务，不维护独立的资源上限副本。
func NewService(repo domaincoderunner.TaskRepository, runner SandboxRunner, sink StreamSink, resolver LangResolver, policies PolicyProvider) *Service {
	return &Service{repo: repo, runner: runner, sink: sink, resolver: resolver, policies: policies, changed: make(chan struct{})}
}

// StartExec 提交执行请求（轮询路径）。
//
// 校验通过后生成 task_id 入队，后台执行 Run，结果写 repo 供 GetExecResult 轮询。
// 返回 task_id。语言不支持 / 源码过大时返回领域错误（前端可见具体原因）。
func (s *Service) StartExec(ctx context.Context, req ExecRequest, userID domainshared.ID) (string, error) {
	return s.start(ctx, req, userID, false)
}

// StartExecStream 提交流式执行请求（SSE 路径）。
//
// 校验同 StartExec，额外创建 SSE channel 注册到 sink。后台执行 RunStream，
// stdout/stderr chunk 实时推 channel；结束时推 done chunk 并更新 repo。
func (s *Service) StartExecStream(ctx context.Context, req ExecRequest, userID domainshared.ID) (string, error) {
	return s.start(ctx, req, userID, true)
}

func (s *Service) start(ctx context.Context, req ExecRequest, userID domainshared.ID, stream bool) (string, error) {
	policy, _, err := s.Policy()
	if err != nil {
		return "", err
	}
	langKey := s.resolver.Normalize(req.Language)
	if err := s.validate(req.Source, langKey, policy); err != nil {
		return "", err
	}
	if err := s.runner.Available(); err != nil {
		log.Warn().Err(err).Str("language", langKey).Msg("代码执行器不可用")
		return "", domainshared.Internal("代码执行器不可用", err)
	}
	task := domaincoderunner.NewExecutionTask(langKey, req.Source, userID)
	task.SetRetention(time.Duration(policy.TaskTTLSecs)*time.Second, time.Duration(policy.QueueTimeoutSecs+policy.MaxTimeoutSecs+30)*time.Second)
	if err := s.repo.Save(ctx, task); err != nil {
		return "", err
	}
	var ch chan OutputChunk
	if stream {
		ch = s.sink.Insert(task.ID().String(), task.StorageTTL())
	}
	go s.runBackground(task, langKey, req.Overrides, ch, policy)
	return task.ID().String(), nil
}

// GetExecResult 查询任务结果（轮询兜底路径）。
func (s *Service) GetExecResult(ctx context.Context, taskID string) (ExecTask, error) {
	id, err := domainshared.ParseID(taskID)
	if err != nil {
		return ExecTask{}, domaincoderunner.ErrTaskNotFound
	}
	task, err := s.repo.Get(ctx, id)
	if err != nil {
		return ExecTask{}, err
	}
	return FromDomainTask(task), nil
}

// ConsumeStream 取走 taskID 的 SSE channel（一次性消费）。
// 返回 nil 表示不存在或已被消费。SSE handler 调此方法拿 channel。
func (s *Service) ConsumeStream(taskID string) chan OutputChunk {
	if consumer, ok := s.sink.(StreamConsumer); ok {
		return consumer.Take(taskID)
	}
	return nil
}

// Policy 返回可用于新任务的有效策略，读取故障不降级为默认值。
func (s *Service) Policy() (domainsettings.CodeRunnerPolicy, uint64, error) {
	if s.policies == nil {
		return domainsettings.CodeRunnerPolicy{}, 0, domainshared.Internal("运行策略不可用", nil)
	}
	if err := s.policies.CodeRunnerError(); err != nil {
		return domainsettings.CodeRunnerPolicy{}, 0, domainshared.Internal("运行策略不可用", err)
	}
	policy, version := s.policies.CodeRunner()
	return policy, version, nil
}

func (s *Service) validate(source, lang string, policy domainsettings.CodeRunnerPolicy) *domainshared.DomainError {
	if !policy.Enabled {
		return domainshared.BadRequest("代码运行器已被禁用")
	}
	if !domaincoderunner.IsValidLanguage(lang) || !slices.Contains(policy.Languages, lang) {
		return domainshared.BadRequest("不支持该执行语言")
	}
	if uint64(len(source)) > policy.MaxSourceBytes {
		return domainshared.BadRequest("源代码过大")
	}
	return nil
}

// acquire 不替换令牌容器，降容时已有名额仍计入 active。
func (s *Service) acquire(ctx context.Context) (domainsettings.CodeRunnerPolicy, error) {
	var ticker *time.Ticker
	defer func() {
		if ticker != nil {
			ticker.Stop()
		}
	}()
	for {
		if err := ctx.Err(); err != nil {
			return domainsettings.CodeRunnerPolicy{}, err
		}
		s.mu.Lock()
		policy, _, err := s.Policy()
		if err != nil {
			s.mu.Unlock()
			return policy, err
		}
		if s.active < policy.MaxConcurrent {
			s.active++
			s.mu.Unlock()
			return policy, nil
		}
		changed := s.changed
		s.mu.Unlock()
		if ticker == nil {
			ticker = time.NewTicker(50 * time.Millisecond)
		}
		select {
		case <-ctx.Done():
			return domainsettings.CodeRunnerPolicy{}, ctx.Err()
		case <-changed:
		case <-ticker.C:
		}
	}
}

func (s *Service) release() {
	s.mu.Lock()
	s.active--
	close(s.changed)
	s.changed = make(chan struct{})
	s.mu.Unlock()
}

// runBackground 排队准入后重查策略，并复用两条沙箱执行路径。
//
// emit 非 nil 时为流式模式（stdout/stderr 实时推 channel）。
// 系统内部异常（容器拉起失败等）记日志，task 标 Failed + 脱敏文案。
func (s *Service) runBackground(
	task *domaincoderunner.ExecutionTask,
	langKey string,
	overrides *domaincoderunner.ResourceLimits,
	emit chan OutputChunk,
	submitted domainsettings.CodeRunnerPolicy,
) {
	ctx := context.Background()
	queueCtx, cancel := context.WithDeadline(ctx, task.CreatedAt().Add(time.Duration(submitted.QueueTimeoutSecs)*time.Second))
	defer cancel()
	current, err := s.acquire(queueCtx)
	if err != nil {
		if queueCtx.Err() != nil {
			task.MarkRejected("排队超时")
			s.complete(ctx, task, emit)
		} else {
			s.finishFailed(ctx, task, emit, 0, false, err)
		}
		return
	}
	defer s.release()
	if err := s.validate(task.Source(), langKey, current); err != nil {
		task.MarkRejected(err.Message)
		s.complete(ctx, task, emit)
		return
	}

	// 解析语言定义
	image, cmd, ext, defaultLimits, langAllowNet, ok := s.resolver.Resolve(langKey)
	if !ok {
		s.finishFailed(ctx, task, emit, 0, false, fmt.Errorf("语言未注册: %s", langKey))
		return
	}

	limits := defaultLimits
	if overrides != nil {
		limits = *overrides
	}
	limits = clampLimits(clampLimits(limits, langAllowNet, submitted), langAllowNet, current)
	task.MarkRunning()
	if err := s.repo.Save(ctx, task); err != nil {
		s.finishFailed(ctx, task, emit, 0, false, err)
		return
	}

	start := time.Now()
	var outcome RunOutcome
	var runErr error
	if emit != nil {
		outcome, runErr = s.runner.RunStream(ctx, image, cmd, task.Source(), ext, limits,
			func(c OutputChunk) {
				select {
				case emit <- c:
				default:
					// channel 满则丢弃（防阻塞执行），SSE 会丢部分输出但不卡死
				}
			})
	} else {
		outcome, runErr = s.runner.Run(ctx, image, cmd, task.Source(), ext, limits)
	}
	duration := uint64(time.Since(start).Milliseconds())

	s.finishTask(ctx, task, emit, outcome, runErr, duration)
}

// finishTask 根据执行结果更新任务状态。
func (s *Service) finishTask(ctx context.Context, task *domaincoderunner.ExecutionTask, emit chan OutputChunk, outcome RunOutcome, runErr error, duration uint64) {
	switch {
	case runErr != nil && !outcome.TimedOut:
		log.Error().Err(runErr).Str("task_id", task.ID().String()).Msg("容器执行失败")
		task.MarkFailed(duration)
	case outcome.TimedOut:
		task.MarkTimeout(duration)
	case outcome.OOMKilled:
		task.MarkOomKilled(outcome.Stdout, outcome.Stderr, outcome.ExitCode, duration)
	case outcome.ExitCode != nil && *outcome.ExitCode == 0:
		task.MarkSuccess(outcome.Stdout, outcome.Stderr, outcome.ExitCode, duration)
	default:
		task.MarkError(outcome.Stdout, outcome.Stderr, outcome.ExitCode, duration)
	}

	s.complete(ctx, task, emit)
}

// finishFailed 标记失败并收尾（排队超时、语言未注册等前置失败）。
func (s *Service) finishFailed(ctx context.Context, task *domaincoderunner.ExecutionTask, emit chan OutputChunk, duration uint64, timedOut bool, cause error) {
	if timedOut {
		task.MarkTimeout(duration)
	} else {
		log.Error().Err(cause).Str("task_id", task.ID().String()).Msg("执行前置失败")
		task.MarkFailed(duration)
	}
	s.complete(ctx, task, emit)
}

func (s *Service) complete(ctx context.Context, task *domaincoderunner.ExecutionTask, emit chan OutputChunk) {
	s.persist(ctx, task)
	if emit != nil {
		s.emitDone(emit, task)
		s.sink.Complete(task.ID().String(), task.RetentionTTL())
	}
}

// persist 保存任务到 repo，失败仅记日志（后台执行，错误无法回传）。
func (s *Service) persist(ctx context.Context, task *domaincoderunner.ExecutionTask) {
	if err := s.repo.Save(ctx, task); err != nil {
		log.Error().Err(err).Str("task_id", task.ID().String()).Msg("保存任务状态失败")
	}
}

// emitDone 推送 done chunk 并关闭 channel。
func (s *Service) emitDone(ch chan OutputChunk, task *domaincoderunner.ExecutionTask) {
	select {
	case ch <- OutputChunk{Type: "done", Data: donePayload(task)}:
	default:
	}
	close(ch)
}

// donePayload 构造 done 事件的 JSON 载荷（ExecResult 形态）。
func donePayload(task *domaincoderunner.ExecutionTask) string {
	return fmt.Sprintf(`{"status":%q,"stdout":%q,"stderr":%q,"exit_code":%s,"duration_ms":%d,"language":%q}`,
		task.Status(), task.Stdout(), task.Stderr(), exitCodeJSON(task.ExitCode()), task.DurationMs(), task.Language())
}

func exitCodeJSON(code *int) string {
	if code == nil {
		return "null"
	}
	return fmt.Sprintf("%d", *code)
}

func clampLimits(limits domaincoderunner.ResourceLimits, languageNetwork bool, policy domainsettings.CodeRunnerPolicy) domaincoderunner.ResourceLimits {
	cpu := limits.CPUCores
	if math.IsNaN(cpu) || math.IsInf(cpu, 0) {
		cpu = 0.1
	}
	return domaincoderunner.ResourceLimits{
		CPUCores:     min(max(cpu, 0.1), policy.MaxCPUCores),
		MemoryMB:     min(max(limits.MemoryMB, 16), policy.MaxMemoryMB),
		TimeoutSecs:  min(max(limits.TimeoutSecs, 1), policy.MaxTimeoutSecs),
		OutputBytes:  min(max(limits.OutputBytes, 1), policy.MaxOutputBytes),
		AllowNetwork: limits.AllowNetwork && languageNetwork && policy.AllowNetwork,
	}
}
