package coderunner

import (
	"context"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"

	domaincoderunner "blog-api/internal/domain/coderunner"
	domainshared "blog-api/internal/domain/shared"
)

// Config 执行服务运行期配置（从 config.CodeRunnerConfig 派生）。
type Config struct {
	MaxSourceBytes   uint64
	MaxConcurrent    int
	QueueTimeoutSecs uint64
	TaskTTLSecs      uint64
}

// StreamSink 流式输出的 channel 生产者接口（StreamRegistry 实现之）。
// service 只依赖此窄接口，不直接依赖 infrastructure 的 StreamRegistry 具体类型。
type StreamSink interface {
	Insert(taskID string) chan OutputChunk
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

// RunnerAlias SandboxRunner 类型别名（保持 service 依赖 application 层定义的端口）。
type RunnerAlias = SandboxRunner

// Service 代码执行用例服务。
//
// StartExec（轮询路径）与 StartExecStream（SSE 流式路径）共用同一套校验链
// 与后台执行逻辑。校验：语言白名单 → 源码大小。后台执行：信号量限并发 →
// ClampLimits 资源钳制 → Runner 起隔离容器。错误脱敏：匿名可见
// 「不支持的语言/超限」；系统内部异常一律「系统暂时不可用」（见 ADR-0006）。
type Service struct {
	repo     domaincoderunner.TaskRepository
	runner   RunnerAlias
	sink     StreamSink
	resolver LangResolver
	cfg      Config
	sem      chan struct{} // 并发槽（MaxConcurrent）
	ttl      time.Duration
}

// NewService 构造执行服务。sem 大小 = cfg.MaxConcurrent。
func NewService(repo domaincoderunner.TaskRepository, runner RunnerAlias, sink StreamSink, resolver LangResolver, cfg Config) *Service {
	conc := cfg.MaxConcurrent
	if conc <= 0 {
		conc = 4
	}
	return &Service{
		repo:     repo,
		runner:   runner,
		sink:     sink,
		resolver: resolver,
		cfg:      cfg,
		sem:      make(chan struct{}, conc),
		ttl:      time.Duration(cfg.TaskTTLSecs) * time.Second,
	}
}

// StartExec 提交执行请求（轮询路径）。
//
// 校验通过后生成 task_id 入队，后台执行 Run，结果写 repo 供 GetExecResult 轮询。
// 返回 task_id。语言不支持 / 源码过大时返回领域错误（前端可见具体原因）。
func (s *Service) StartExec(ctx context.Context, req ExecRequest, userID domainshared.ID) (string, error) {
	if err := s.validate(req); err != nil {
		return "", err
	}

	langKey := s.resolver.Normalize(req.Language)
	task := domaincoderunner.NewExecutionTask(langKey, req.Source, userID)
	if err := s.repo.Save(ctx, task); err != nil {
		return "", err
	}

	go s.runBackground(task, langKey, req.Overrides, nil)
	return task.ID().String(), nil
}

// StartExecStream 提交流式执行请求（SSE 路径）。
//
// 校验同 StartExec，额外创建 SSE channel 注册到 sink。后台执行 RunStream，
// stdout/stderr chunk 实时推 channel；结束时推 done chunk 并更新 repo。
func (s *Service) StartExecStream(ctx context.Context, req ExecRequest, userID domainshared.ID) (string, error) {
	if err := s.validate(req); err != nil {
		return "", err
	}

	langKey := s.resolver.Normalize(req.Language)
	task := domaincoderunner.NewExecutionTask(langKey, req.Source, userID)
	if err := s.repo.Save(ctx, task); err != nil {
		return "", err
	}

	ch := s.sink.Insert(task.ID().String())
	go s.runBackground(task, langKey, req.Overrides, ch)
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

// validate 校验语言白名单与源码大小。
//
// 非终态错误（语言不支持/源码过大）返回领域错误，前端可见具体原因。
// 速率限制由中间件层处理（CodeRunnerRateLimit），admin 放行也由中间件判断。
func (s *Service) validate(req ExecRequest) error {
	if !domaincoderunner.IsValidLanguage(req.Language) {
		return domainshared.BadRequest("不支持该执行语言")
	}
	if uint64(len(req.Source)) > s.cfg.MaxSourceBytes {
		return domainshared.BadRequest("源代码过大")
	}
	// 前置探测执行器可用性：功能未启用 / daemon 连接失败时直接拒绝，
	// 把可操作的错误信息直达前端（而非后台执行后才报含糊的「系统暂时不可用」）。
	if err := s.runner.Available(); err != nil {
		log.Warn().Err(err).Str("language", req.Language).Msg("代码运行器不可用，拒绝执行")
		return domainshared.Internal(err.Error(), err)
	}
	return nil
}

// runBackground 后台执行：排队等信号量 → ClampLimits → Run/RunStream → 更新 task。
//
// emit 非 nil 时为流式模式（stdout/stderr 实时推 channel）。
// 系统内部异常（容器拉起失败等）记日志，task 标 Failed + 脱敏文案。
func (s *Service) runBackground(
	task *domaincoderunner.ExecutionTask,
	langKey string,
	overrides *domaincoderunner.ResourceLimits,
	emit chan OutputChunk,
) {
	ctx := context.Background()

	// 排队等待容器槽（带超时，防排队过久）
	queueTimeout := time.Duration(s.cfg.QueueTimeoutSecs) * time.Second
	select {
	case s.sem <- struct{}{}:
		defer func() { <-s.sem }()
	case <-time.After(queueTimeout):
		s.finishFailed(ctx, task, emit, 0, false, fmt.Errorf("排队超时"))
		return
	}

	// 解析语言定义
	image, cmd, ext, defaultLimits, langAllowNet, ok := s.resolver.Resolve(langKey)
	if !ok {
		s.finishFailed(ctx, task, emit, 0, false, fmt.Errorf("语言未注册: %s", langKey))
		return
	}

	task.MarkRunning()
	s.persist(ctx, task)

	// 合并 + 钳制资源限制
	limits := defaultLimits
	if overrides != nil {
		limits = *overrides
	}
	limits = clampLimits(limits, langAllowNet)

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

	s.persist(ctx, task)
	if emit != nil {
		s.emitDone(emit, task)
	}
}

// finishFailed 标记失败并收尾（排队超时、语言未注册等前置失败）。
func (s *Service) finishFailed(ctx context.Context, task *domaincoderunner.ExecutionTask, emit chan OutputChunk, duration uint64, timedOut bool, cause error) {
	if timedOut {
		task.MarkTimeout(duration)
	} else {
		log.Error().Err(cause).Str("task_id", task.ID().String()).Msg("执行前置失败")
		task.MarkFailed(duration)
	}
	s.persist(ctx, task)
	if emit != nil {
		s.emitDone(emit, task)
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

// clampLimits 资源钳制端口。由 infrastructure 通过 SetClampLimits 注入，
// 避免 application 直接依赖 infrastructure 包。
var clampLimits = func(merged domaincoderunner.ResourceLimits, langAllowsNetwork bool) domaincoderunner.ResourceLimits {
	return merged // 兜底：未注入时不钳制（仅测试用）
}

// SetClampLimits 由 infrastructure 在初始化时调用，注入真实的 ClampLimits。
// 生产必须调用，否则资源钳制不生效。
func SetClampLimits(fn func(domaincoderunner.ResourceLimits, bool) domaincoderunner.ResourceLimits) {
	clampLimits = fn
}
