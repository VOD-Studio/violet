package coderunner

import (
	"context"

	domaincoderunner "blog-api/internal/domain/coderunner"
)

// OutputChunk 流式执行的单个输出片段（SSE 一个事件）。
//
// Type 为 "stdout" / "stderr" / "done"。Data 为文本内容（done 时为
// ExecResult 的 JSON）。流式路径用它推 SSE。
type OutputChunk struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

// RunOutcome 容器执行的一次性结果（轮询路径用）。
//
// OOMKilled 为 true 时 Status 由调用方映射为 OomKilled（容器被 OOM killer 杀）。
// TimedOut 为 true 时映射为 Timeout（context 超时强杀）。
type RunOutcome struct {
	ExitCode   *int
	Stdout     string
	Stderr     string
	OOMKilled  bool // 容器被 OOM killer 杀掉；true 时调用方将 Status 映射为 oom_killed
	TimedOut   bool // context 超时强杀容器；true 时调用方将 Status 映射为 timeout
}

// SandboxRunner 沙箱执行器端口（基础设施接口）。
//
// 实现：infrastructure/coderunner/docker_runner.go（Docker SDK 调 unix socket）。
// 两条方法对应两条执行路径：Run 一次性返回（轮询），RunStream 边执行边推
// chunk 到回调（SSE 流式）。两者共用同一套容器隔离配置（见 ADR-0006）。
type SandboxRunner interface {
	// Available 探测执行器是否可用（daemon 已连接）。
	//
	// 不可用时返回明确错误（功能未启用 / daemon 连接失败），供 service 在
	// 提交时（validate 阶段）前置拦截，把可操作的错误信息直达前端，
	// 而非等到后台执行才报含糊的「系统暂时不可用」。
	Available() error

	// Run 起隔离容器执行，阻塞至完成，返回一次性结果。
	//
	// image 为镜像名（如 yggdrasil-runner-python:latest），cmd 为容器内执行命令，
	// source 注入到 /code/main.<ext>，limits 为钳制后的最终资源限制。
	Run(ctx context.Context, image, cmd, source, ext string, limits domaincoderunner.ResourceLimits) (RunOutcome, error)

	// RunStream 起隔离容器执行，边输出边调 emit 推 OutputChunk。
	//
	// 与 Run 同输入，区别是 stdout/stderr 实时分块回流（而非攒到结束）。
	// 结束时不再调 emit（由 application 层在方法返回后推 done chunk）。
	RunStream(ctx context.Context, image, cmd, source, ext string, limits domaincoderunner.ResourceLimits, emit func(OutputChunk)) (RunOutcome, error)
}
