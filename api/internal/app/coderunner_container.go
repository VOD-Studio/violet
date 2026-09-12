package app

import (
	"time"

	"github.com/redis/go-redis/v9"

	"blog-api/config"
	appcoderunner "blog-api/internal/application/coderunner"
	domainsettings "blog-api/internal/domain/settings"
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
// enabled 与资源阈值读取已应用快照，接收任务时固定资源限制。
// Docker client 始终初始化（启动就连 socket，失败降级记日志）——enabled 纯业务开关，
// 关闭时 validate 拒绝执行，但 client 连接状态与之解耦。
//
// settingsStore 由 settings 服务提供不可变有效配置，不直接读取数据库。
func NewCodeRunnerContainer(redisClient *redis.Client, settingsStore domainsettings.SettingsStore, cfg config.CodeRunnerConfig) *CodeRunnerContainer {
	// 公开语言注册表的启动配置；任务执行使用独立有效快照。
	infracoderunner.InitMaxLimits(cfg)
	// 两种钳制路径均为纯计算，不再在请求期间修改全局资源上限。
	appcoderunner.SetClampLimits(infracoderunner.ClampLimits)
	appcoderunner.SetClampSettings(infracoderunner.ClampSettings)
	// 始终初始化 Docker client（socket 缺失时降级记日志，不 panic）
	infracoderunner.InitDockerClient(cfg.DockerSocketPath)

	taskStore := infracoderunner.NewRedisTaskStore(redisClient, time.Duration(cfg.TaskTTLSecs)*time.Second)
	streamRegistry := infracoderunner.NewStreamRegistry(time.Duration(cfg.TaskTTLSecs) * time.Second)
	runner := infracoderunner.NewDockerRunner(infracoderunner.SharedDockerClient())
	resolver := infracoderunner.NewLangResolver()

	svc := appcoderunner.NewService(taskStore, runner, streamRegistry, resolver, settingsStore, appcoderunner.Config{
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
