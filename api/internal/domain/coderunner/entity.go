package coderunner

import (
	"time"

	domainshared "blog-api/internal/domain/shared"
)

// 终态 stderr 的固定文案。
const (
	timeoutMessage = "执行超时"
	// failedMessage 系统内部异常的脱敏文案。
	// 容器拉起失败、daemon 不可用等细节记服务端日志，对前端只见此通用消息（见 ADR-0006）。
	failedMessage = "系统暂时不可用"
)

// ExecutionTask 单次代码执行任务的聚合根。
//
// 生命周期：NewExecutionTask 创建（Queued）→ application 层后台执行 →
// MarkRunning → 某个 Mark* 终态方法（Success/Error/Timeout/OomKilled/Failed）。
// 每次状态变更后由 TaskRepository 持久化（Redis，带 TTL）。
type ExecutionTask struct {
	domainshared.AggregateRoot

	// id 任务唯一标识（NewExecutionTask 时 NewID 生成）
	id domainshared.ID
	// userID 提交执行的用户 ID
	userID domainshared.ID
	// language 代码语言 canonical key（python/node/go/rust/bun）
	//
	// domain 不二次校验——application 层入队前已用 IsValidLanguage 拦截，这里只记录原值。
	language string
	// source 待执行的源码
	source string
	// status 任务状态（queued/running/success/error/timeout/oom_killed/failed，见状态机注释）
	status string
	// stdout 用户代码标准输出（仅终态方法 MarkSuccess/MarkError/MarkOomKilled 填充）
	stdout string
	// stderr 用户代码标准错误（成功/错误态记真实内容；系统异常态记固定脱敏文案 failedMessage）
	stderr string
	// exitCode 用户进程退出码（指针；超时强杀等无自然退出码的终态为 nil）
	exitCode *int
	// durationMs 执行耗时（毫秒，各终态方法写入）
	durationMs uint64
	// timestamps 创建/更新时间（每次状态变更刷新 UpdatedAt，供 TaskRepository 判定 GC 时机）
	timestamps domainshared.Timestamps
}

// NewExecutionTask 创建新执行任务（Queued 状态）。
//
// 不在此校验语言合法性——application 层在入队前已用 IsValidLanguage 拦截。
// domain 层只记录事实，保留调用方传入的原值。
func NewExecutionTask(language, source string, userID domainshared.ID) *ExecutionTask {
	now := time.Now()
	return &ExecutionTask{
		id:         domainshared.NewID(),
		userID:     userID,
		language:   language,
		source:     source,
		status:     StatusQueued,
		timestamps: domainshared.Timestamps{CreatedAt: now, UpdatedAt: now},
	}
}

// ReconstructExecutionTask 从持久化数据重建任务（不经过任何校验，原样恢复）。
func ReconstructExecutionTask(
	id, userID domainshared.ID,
	language, source, status, stdout, stderr string,
	exitCode *int, durationMs uint64, createdAt time.Time,
) *ExecutionTask {
	return &ExecutionTask{
		id:         id,
		userID:     userID,
		language:   language,
		source:     source,
		status:     status,
		stdout:     stdout,
		stderr:     stderr,
		exitCode:   exitCode,
		durationMs: durationMs,
		timestamps: domainshared.Timestamps{CreatedAt: createdAt, UpdatedAt: time.Now()},
	}
}

// 状态迁移方法。每次变更刷新 UpdatedAt，供 TaskRepository 判定 GC 时机。

// MarkRunning 标记任务进入运行态。
func (t *ExecutionTask) MarkRunning() {
	t.status = StatusRunning
	t.timestamps.UpdatedAt = time.Now()
}

// MarkSuccess 用户代码正常退出（exit 0）。
func (t *ExecutionTask) MarkSuccess(stdout, stderr string, exitCode *int, durationMs uint64) {
	t.status = StatusSuccess
	t.stdout = stdout
	t.stderr = stderr
	t.exitCode = exitCode
	t.durationMs = durationMs
	t.timestamps.UpdatedAt = time.Now()
}

// MarkError 用户代码非零退出（exit != 0）。
func (t *ExecutionTask) MarkError(stdout, stderr string, exitCode *int, durationMs uint64) {
	t.status = StatusError
	t.stdout = stdout
	t.stderr = stderr
	t.exitCode = exitCode
	t.durationMs = durationMs
	t.timestamps.UpdatedAt = time.Now()
}

// MarkTimeout 执行超时被强杀。
func (t *ExecutionTask) MarkTimeout(durationMs uint64) {
	t.status = StatusTimeout
	t.stderr = timeoutMessage
	t.durationMs = durationMs
	t.timestamps.UpdatedAt = time.Now()
}

// MarkOomKilled 容器因内存超限被 OOM killer 杀掉。
func (t *ExecutionTask) MarkOomKilled(stdout, stderr string, exitCode *int, durationMs uint64) {
	t.status = StatusOomKilled
	t.stdout = stdout
	t.stderr = stderr
	t.exitCode = exitCode
	t.durationMs = durationMs
	t.timestamps.UpdatedAt = time.Now()
}

// MarkFailed 系统内部异常（容器拉起失败、daemon 不可用等）。
//
// stderr 固定为脱敏文案 failedMessage，细节由 application 层记日志。
func (t *ExecutionTask) MarkFailed(durationMs uint64) {
	t.status = StatusFailed
	t.stderr = failedMessage
	t.durationMs = durationMs
	t.timestamps.UpdatedAt = time.Now()
}

// 访问器
func (t *ExecutionTask) ID() domainshared.ID { return t.id }
func (t *ExecutionTask) UserID() domainshared.ID { return t.userID }
func (t *ExecutionTask) Language() string        { return t.language }
func (t *ExecutionTask) Source() string          { return t.source }
func (t *ExecutionTask) Status() string          { return t.status }
func (t *ExecutionTask) Stdout() string          { return t.stdout }
func (t *ExecutionTask) Stderr() string          { return t.stderr }
func (t *ExecutionTask) ExitCode() *int          { return t.exitCode }
func (t *ExecutionTask) DurationMs() uint64      { return t.durationMs }
func (t *ExecutionTask) CreatedAt() time.Time    { return t.timestamps.CreatedAt }
func (t *ExecutionTask) UpdatedAt() time.Time    { return t.timestamps.UpdatedAt }
