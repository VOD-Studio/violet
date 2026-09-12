package app

import (
	"database/sql"
	"strings"
	"time"

	"blog-api/config"
	appsettings "blog-api/internal/application/settings"
)

type startupSettings struct {
	cfg *config.Config
	db  *sql.DB
}

func (s startupSettings) Snapshot() appsettings.StartupSnapshot {
	c := s.cfg
	field := func(key, label string, value any) appsettings.StartupField {
		return appsettings.StartupField{Key: key, Label: label, Value: value, Source: c.Source(key)}
	}
	metric := func(key, label string, value any) appsettings.StartupField {
		return appsettings.StartupField{Key: key, Label: label, Value: value, Source: "runtime"}
	}
	secret := func(key, label, value string) appsettings.StartupField {
		f := field(key, label, value != "")
		f.Sensitive = true
		return f
	}
	stats := s.db.Stats()
	return appsettings.StartupSnapshot{ObservedAt: time.Now().UTC(), Sections: []appsettings.StartupSection{
		{ID: "server", Label: "服务与部署", Fields: []appsettings.StartupField{
			field("environment", "运行环境", c.Environment), field("port", "监听端口", c.Port),
			field("upload_dir", "上传目录", c.UploadDir), field("upload_path_prefix", "上传 URL 前缀", c.UploadPathPrefix),
			field("trusted_proxies", "受信代理", strings.Join(c.TrustedProxies, ", ")),
			field("cors_allowed_origins", "允许来源", strings.Join(c.CORSAllowedOrigins, ", ")),
			field("runtime_log_enabled", "运行日志持久化采集", c.RuntimeLogEnabled),
		}},
		{ID: "database", Label: "数据库（业务共用连接池）", Fields: []appsettings.StartupField{
			field("database.host", "主机", c.Database.Host), field("database.port", "端口", c.Database.Port),
			field("database.name", "数据库", c.Database.Name), field("database.user", "用户", c.Database.User),
			secret("database.password", "密码已配置", c.Database.Password), field("database.sslmode", "SSL 模式", c.Database.SSLMode),
			field("database.max_open_conns", "实际最大连接数", stats.MaxOpenConnections),
			field("database.max_idle_conns", "最大空闲连接数", c.Database.MaxIdleConns),
			field("database.conn_max_lifetime", "连接最大存活时间", c.Database.ConnMaxLifetime.String()),
			metric("database.stats.open_connections", "当前打开连接", stats.OpenConnections),
			metric("database.stats.in_use", "当前使用连接", stats.InUse), metric("database.stats.idle", "当前空闲连接", stats.Idle),
			metric("database.stats.wait_count", "累计等待次数", stats.WaitCount), metric("database.stats.wait_duration_ms", "累计等待毫秒", stats.WaitDuration.Milliseconds()),
			metric("database.stats.max_idle_closed", "空闲上限释放连接", stats.MaxIdleClosed),
			metric("database.stats.max_lifetime_closed", "存活期到期释放连接", stats.MaxLifetimeClosed),
		}},
		{ID: "redis", Label: "Redis", Fields: []appsettings.StartupField{
			field("redis.host", "主机", c.Redis.Host), field("redis.port", "端口", c.Redis.Port), field("redis.db", "数据库编号", c.Redis.DB), secret("redis.password", "密码已配置", c.Redis.Password),
		}},
		{ID: "security", Label: "启动凭据与会话", Fields: []appsettings.StartupField{
			secret("resource_signing_key", "资源签名密钥已配置", c.ResourceSigningKey),
			secret("github_client_secret", "GitHub OAuth 密钥已配置", c.GithubClientSecret),
			secret("resend_api_key", "邮件 API 密钥已配置", c.ResendAPIKey),
			secret("web_push.vapid_private_key", "Web Push 私钥已配置", c.WebPush.VAPIDPrivateKey),
			field("session.idle_ttl", "会话空闲有效期", c.Session.IdleTTL.String()), field("session.max_ttl", "会话绝对有效期", c.Session.MaxTTL.String()),
			field("cookie.secure", "仅 HTTPS Cookie", c.Cookie.Secure), field("cookie.samesite", "Cookie SameSite", c.Cookie.SameSite),
		}},
		{ID: "code-runner", Label: "运行器启动限制", Fields: []appsettings.StartupField{
			field("code_runner.docker_socket_path", "Docker Socket", c.CodeRunner.DockerSocketPath), field("code_runner.max_concurrent", "最大并发", c.CodeRunner.MaxConcurrent),
			field("code_runner.queue_timeout_secs", "排队超时秒", c.CodeRunner.QueueTimeoutSecs), field("code_runner.task_ttl_secs", "任务保留秒", c.CodeRunner.TaskTTLSecs),
		}},
	}}
}
