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
// enabled 开关与资源阈值走 site_settings（运行时可改），由 service.validate 每次实时读取。
// Docker client 始终初始化（启动就连 socket，失败降级记日志）——enabled 纯业务开关，
// 关闭时 validate 拒绝执行，但 client 连接状态与之解耦。
//
// settingsStore 注入 service 供运行时读取配置；env cfg 作为 site_settings 未配时的 fallback。
func NewCodeRunnerContainer(redisClient *redis.Client, settingsStore domainsettings.SettingsStore, cfg config.CodeRunnerConfig) *CodeRunnerContainer {
	// 初始化全局上限与语言白名单（infrastructure 包级状态）+ 保存 env fallback
	infracoderunner.InitMaxLimits(cfg)
	// 注入资源钳制函数 + 资源上限刷新函数（application service 调用）
	appcoderunner.SetClampLimits(infracoderunner.ClampLimits)
	appcoderunner.SetReloadLimitsFn(infracoderunner.ReloadMaxLimitsFromMap)
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
