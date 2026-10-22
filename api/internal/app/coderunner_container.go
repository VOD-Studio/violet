package app

import (
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

// NewCodeRunnerContainer 装配共享策略、Docker 沙箱与任务存储。
func NewCodeRunnerContainer(redisClient *redis.Client, policies appcoderunner.PolicyProvider, cfg config.CodeRunnerConfig) *CodeRunnerContainer {
	infracoderunner.InitDockerClient(cfg.DockerSocketPath)
	taskStore := infracoderunner.NewRedisTaskStore(redisClient)
	streamRegistry := infracoderunner.NewStreamRegistry()
	runner := infracoderunner.NewDockerRunner(infracoderunner.SharedDockerClient())
	resolver := infracoderunner.NewLangResolver()
	svc := appcoderunner.NewService(taskStore, runner, streamRegistry, resolver, policies)

	return &CodeRunnerContainer{
		CodeRunnerHandler: codehttp.NewHandler(svc),
		Service:           svc,
	}
}
