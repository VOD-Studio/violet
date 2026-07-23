package app

import (
	"time"

	"github.com/redis/go-redis/v9"

	"blog-api/config"
	appcoderunner "blog-api/internal/application/coderunner"
	infracoderunner "blog-api/internal/infrastructure/coderunner"
	codehttp "blog-api/internal/interfaces/http/handler/coderunner"
)

// CodeRunnerContainer code-runner 模块容器。
//
// 装配 Docker 沙箱执行器、Redis 任务存储、SSE channel 注册表、application service、handler。
// 不使用 wire（跟随项目主流手写容器模式）。
type CodeRunnerContainer struct {
	CodeRunnerHandler *codehttp.Handler
	Service           *appcoderunner.Service
}

// NewCodeRunnerContainer 装配 code-runner 模块。
//
// 启用时（cfg.Enabled=true）初始化 Docker client、注入全局上限/钳制函数/语言解析器；
// 禁用时 Docker client 为 nil，执行请求会返回「系统暂时不可用」（docker_runner 降级）。
func NewCodeRunnerContainer(redisClient *redis.Client, cfg config.CodeRunnerConfig) *CodeRunnerContainer {
	// 初始化全局上限与语言白名单（infrastructure 包级状态）
	infracoderunner.InitMaxLimits(cfg)
	// 注入资源钳制函数（application service 调用）
	appcoderunner.SetClampLimits(infracoderunner.ClampLimits)
	// 初始化 Docker client（启用时连接，禁用时跳过——client 为 nil，执行降级）
	if cfg.Enabled {
		infracoderunner.InitDockerClient(cfg.DockerSocketPath)
	}

	taskStore := infracoderunner.NewRedisTaskStore(redisClient, time.Duration(cfg.TaskTTLSecs)*time.Second)
	streamRegistry := infracoderunner.NewStreamRegistry(time.Duration(cfg.TaskTTLSecs) * time.Second)
	runner := infracoderunner.NewDockerRunner(infracoderunner.SharedDockerClient())
	resolver := infracoderunner.NewLangResolver()

	svc := appcoderunner.NewService(taskStore, runner, streamRegistry, resolver, appcoderunner.Config{
		MaxSourceBytes:   cfg.MaxSourceBytes,
		MaxConcurrent:    cfg.MaxConcurrent,
		QueueTimeoutSecs: cfg.QueueTimeoutSecs,
		TaskTTLSecs:      cfg.TaskTTLSecs,
	})

	return &CodeRunnerContainer{
		CodeRunnerHandler: codehttp.NewHandler(svc),
		Service:           svc,
	}
}
