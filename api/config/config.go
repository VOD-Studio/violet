package config

import (
	"fmt"
	"net/http"
	"os"
	"slices"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

// Config 应用配置结构体，集中管理所有配置项
type Config struct {
	// Environment 运行环境（development、staging、production）
	Environment string
	// Database PostgreSQL 数据库配置
	Database DatabaseConfig
	// Redis Redis 配置
	Redis RedisConfig
	// GoogleClientID Google OAuth 客户端 ID
	GoogleClientID string
	// GithubClientID Github OAuth 客户端 ID
	GithubClientID string
	// GithubClientSecret Github OAuth 客户端密钥
	GithubClientSecret string
	// ResendAPIKey Resend 件服务 API 密钥
	ResendAPIKey string
	// EmailFrom 发件人邮箱地址
	EmailFrom string
	// Port 服务监听端口
	Port string
	// UploadPathPrefix 上传文件 URL 前缀，如 "/uploads/"
	UploadPathPrefix string
	// UploadDir 上传文件存储根目录（相对进程工作目录），如 "uploads"。
	// 派生 emojiDir/chunkDir 等子目录，不持久化绝对路径，搬家可移植。
	UploadDir string
	// BilibiliCookie B站登录 Cookie，用于获取表情种子数据（自动拼接）
	BilibiliCookie string
	// BilibiliAPIType B站表情 API 类型：user(用户收藏) 或 official(官方)
	BilibiliAPIType string
	// KiteURL kite 音乐解析服务地址（自托管网易云解析）。
	// 默认 http://localhost:3721，与 kite docker-compose 端口映射对齐。
	KiteURL string
	// Cookie 鉴权 Cookie 配置（opaque session id 通过 HttpOnly Cookie 下发）
	Cookie CookieConfig
	// Session opaque session 生命周期配置（IdleTTL 滑动续期 + MaxTTL 绝对寿命）
	Session SessionConfig
	// CORSAllowedOrigins 允许的前端来源列表（用于跨域 Cookie 与 CSRF 防护）
	// 生产环境通过 CORS_ALLOWED_ORIGINS 环境变量覆盖
	CORSAllowedOrigins []string
	// SuperAdmin 超级管理员配置
	SuperAdmin SuperAdminConfig
	// TrustedProxies 受信代理 CIDR 列表（如 Nginx/CDN 出口 IP）。
	// 非空时，仅当 RemoteAddr 命中此列表才信任 X-Forwarded-For/X-Real-IP；
	// 为空时一律使用 RemoteAddr，拒绝任何客户端自报的转发头（防 IP 欺骗绕过限流）。
	TrustedProxies []string
	// CodeRunner 代码运行器配置（可运行代码块的沙箱执行）。
	// 见 docs/adr/0006-code-runner-architecture.md。为空（Enabled=false）时功能关闭。
	CodeRunner CodeRunnerConfig
}

// CodeRunnerConfig 代码运行器配置。
//
// 控制沙箱执行的全局上限与并发。作者在围栏 info string 声明的 overrides 经
// ClampLimits 钳制到这些 Max* 上限内（见 infrastructure/coderunner/config.go）。
// 默认值对齐 yggdrasil：2 核 / 1024MB / 30s 超时 / 1MB 输出 / 64KB 源码 / 4 并发。
type CodeRunnerConfig struct {
	// Enabled 是否启用代码运行功能。关闭时 exec 端点返回功能不可用。
	// 关闭原因：生产未挂 docker.sock、或临时禁用。
	Enabled bool
	// MaxCPUCores 单次执行 CPU 上限（核数）。
	MaxCPUCores float64
	// MaxMemoryMB 单次执行内存上限（MB）。
	MaxMemoryMB uint64
	// MaxTimeoutSecs 单次执行墙上时间上限（秒）。
	MaxTimeoutSecs uint64
	// MaxOutputBytes 单次执行 stdout+stderr 输出上限（字节）。
	MaxOutputBytes uint64
	// MaxSourceBytes 提交源码大小上限（字节）。
	MaxSourceBytes uint64
	// AllowNetwork 全局是否允许网络。需作者声明、语言允许、此开关三者同时为真。
	AllowNetwork bool
	// MaxConcurrent 同时在跑的容器数量上限。
	MaxConcurrent int
	// QueueTimeoutSecs 排队等待容器槽的超时（秒），超时返回「系统繁忙」。
	QueueTimeoutSecs uint64
	// TaskTTLSecs 完成任务在 Redis 的保留时长（秒），供轮询兜底。
	TaskTTLSecs uint64
	// DockerSocketPath Docker daemon unix socket 路径。兼容 docker 与 podman
	// （podman 用其 docker-compat sock 或原生 sock）。默认 /var/run/docker.sock。
	DockerSocketPath string
	// Languages 语言白名单。空表示注册表里全部语言可用；非空则收窄到列表内
	// （用 canonical key：python/node/go/rust/bun）。
	Languages []string
}

// CookieConfig 鉴权 Cookie 配置
//
// opaque session id 通过 HttpOnly Cookie 下发，避免 JS 读取（防 XSS 偷取）。
// 由此带来的 CSRF 风险通过 double-submit cookie 中间件防护（见 middleware/csrf.go）。
type CookieConfig struct {
	// Domain Cookie 的 Domain 属性
	// 开发环境留空（默认为当前 host）；生产环境填站点主域名（如 example.com）以支持子域共享
	Domain string
	// Secure Cookie 的 Secure 属性
	// true 时仅 HTTPS 才下发；开发环境（HTTP localhost）必须为 false
	Secure bool
	// SameSite Cookie 的 SameSite 属性：lax（默认，兼顾安全与可用）/ strict / none
	// 注意：跨域开发（localhost:5173 → api:9090）必须为 none+secure，否则浏览器拒收
	SameSite string
	// CSRFName CSRF double-submit Cookie 名（非 HttpOnly，供前端读取回传）
	CSRFName string
	// SessionName opaque session id 的 Cookie 名（HttpOnly，浏览器自动携带）
	SessionName string
}

// SessionConfig opaque session 生命周期配置。
//
// IdleTTL 为滑动续期窗口：每个真实请求重置 session 的剩余寿命，活跃用户不过期。
// MaxTTL 为绝对寿命上限：MaxTTL<=0 表示无上限（默认），MaxTTL>0 时从登录起算到点强制重登。
// 实际过期 = min(idle 到期, 绝对到期[若启用])。
type SessionConfig struct {
	// IdleTTL 滑动续期窗口，必须 > 0
	IdleTTL time.Duration
	// MaxTTL 绝对寿命上限，<=0 表示无上限
	MaxTTL time.Duration
}

// SameSiteMode 返回 http.SameSite 枚举值
//
// 配置中用字符串以便 yaml/env 表达，运行时转枚举
func (c CookieConfig) SameSiteMode() http.SameSite {
	switch strings.ToLower(c.SameSite) {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}

// DatabaseConfig PostgreSQL 数据库配置
type DatabaseConfig struct {
	// Host 数据库主机地址
	Host string
	// Port 数据库端口
	Port int
	// Name 数据库名称
	Name string
	// User 数据库用户名
	User string
	// Password 数据库密码
	Password string
	// SSLMode SSL 连接模式（disable、require、verify-ca、verify-full）
	SSLMode string
	// MaxOpenConns 最大打开连接数（默认 25，生产建议 25-100）
	MaxOpenConns int
	// MaxIdleConns 最大空闲连接数（默认 5，应 ≤ MaxOpenConns）
	MaxIdleConns int
	// ConnMaxLifetime 单个连接最大存活时间（默认 30m）
	ConnMaxLifetime time.Duration
}

// DSN 生成 PostgreSQL 连接字符串
func (d *DatabaseConfig) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.Name, d.SSLMode)
}

// RedisConfig Redis 配置
type RedisConfig struct {
	// Host Redis 主机地址
	Host string
	// Port Redis 端口
	Port int
	// DB Redis 数据库编号
	DB int
	// Password Redis 密码（可选）
	Password string
}

// DSN 生成 Redis 连接字符串
func (r *RedisConfig) DSN() string {
	if r.Password != "" {
		return fmt.Sprintf("redis://:%s@%s:%d/%d", r.Password, r.Host, r.Port, r.DB)
	}
	return fmt.Sprintf("redis://%s:%d/%d", r.Host, r.Port, r.DB)
}

// SuperAdminConfig 超级管理员配置
type SuperAdminConfig struct {
	Enabled  bool
	Username string
	Email    string
	Password string
}

// Load 加载配置，来源优先级：进程环境变量 > 根 .env > config.yaml > 代码默认值。
//
// config.yaml 入库并随镜像分发，承载全部配置键与非敏感默认值（唯一权威文档）；
// 根 .env（不入库）承载密钥与环境差异值。启动末尾打印每个配置项的来源与脱敏值。
// 如果必需配置缺失或格式错误，会 panic
func Load() *Config {
	// 加载根 .env（本地开发的密钥唯一来源）。候选路径覆盖两种工作目录：
	// api/(go run/air) 读 ../.env；仓库根(直接跑二进制)读 .env。
	// 容器内两者均不存在,静默跳过(compose 已注入进程环境)。
	preEnvKeys := currentEnvKeys()
	_ = godotenv.Load("../.env", ".env")
	dotenvKeys := readDotenvKeys()

	v := viper.New()

	// 配置文件
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./api")

	// 环境变量覆盖（自动绑定同名键）
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// 默认值
	v.SetDefault("environment", "development")
	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.name", "blog")
	v.SetDefault("database.user", "blog")
	v.SetDefault("database.password", "")
	v.SetDefault("database.sslmode", "disable")
	v.SetDefault("database.max_open_conns", 25)
	v.SetDefault("database.max_idle_conns", 5)
	v.SetDefault("database.conn_max_lifetime", "30m")
	v.SetDefault("redis.host", "localhost")
	v.SetDefault("redis.port", 6379)
	v.SetDefault("redis.db", 0)
	v.SetDefault("redis.password", "")
	v.SetDefault("google_client_id", "")
	v.SetDefault("github_client_id", "")
	v.SetDefault("github_client_secret", "")
	v.SetDefault("resend_api_key", "")
	v.SetDefault("email_from", "noreply@yourdomain.com")
	v.SetDefault("port", "9090")
	v.SetDefault("upload_path_prefix", "/uploads/")
	v.SetDefault("upload_dir", "uploads")
	v.SetDefault("bilibili_cookies", "")
	v.SetDefault("bilibili_api_type", "user")
	v.SetDefault("kite_url", "http://localhost:3721")
	// Cookie 默认值：开发环境友好（HTTP、lax、空 domain）
	// 生产环境必须通过 COOKIE_SECURE=true、COOKIE_DOMAIN、CORS_ALLOWED_ORIGINS 覆盖
	v.SetDefault("cookie.domain", "")
	v.SetDefault("cookie.secure", false)
	v.SetDefault("cookie.samesite", "lax")
	v.SetDefault("cookie.csrf_name", "violet_csrf")
	v.SetDefault("cookie.session_name", "violet_session")
	// session 滑动续期默认 7 天，绝对寿命默认 0（无上限）
	v.SetDefault("session.idle_ttl", "168h")
	v.SetDefault("session.max_ttl", "0s")
	// CORS 允许来源默认覆盖前端开发服务器
	v.SetDefault("cors_allowed_origins", []string{
		"http://localhost:3000",
		"http://localhost:5173",
	})
	v.SetDefault("superadmin.enabled", false)
	v.SetDefault("superadmin.username", "admin")
	v.SetDefault("superadmin.email", "admin@example.com")
	v.SetDefault("superadmin.password", "")
	// 受信代理默认为空：未配置时一律使用 RemoteAddr，拒绝客户端自报转发头
	v.SetDefault("trusted_proxies", []string{})
	// 代码运行器默认值（对齐 yggdrasil runner_config.rs）
	// Enabled 默认 false：需显式开启并确认 docker.sock 已挂载
	// 代码运行器默认启用：本地开发友好（装了 docker 即可用）。
	// 生产环境若未挂 docker.sock，InitDockerClient 探活失败会降级（记日志，不 panic），
	// 执行请求返回「daemon 不可连接」提示，不影响博客其他功能。
	v.SetDefault("code_runner.enabled", true)
	v.SetDefault("code_runner.max_cpu_cores", 2.0)
	v.SetDefault("code_runner.max_memory_mb", 1024)
	v.SetDefault("code_runner.max_timeout_secs", 30)
	v.SetDefault("code_runner.max_output_bytes", 1048576)
	v.SetDefault("code_runner.max_source_bytes", 65536)
	v.SetDefault("code_runner.allow_network", false)
	v.SetDefault("code_runner.max_concurrent", 4)
	v.SetDefault("code_runner.queue_timeout_secs", 30)
	v.SetDefault("code_runner.task_ttl_secs", 300)
	v.SetDefault("code_runner.docker_socket_path", "/var/run/docker.sock")
	v.SetDefault("code_runner.languages", []string{})

	// 读取配置文件（不存在也不报错）
	_ = v.ReadInConfig()

	// 解析时间配置，如果格式错误则 panic
	sessionIdleTTL, err := time.ParseDuration(v.GetString("session.idle_ttl"))
	if err != nil {
		panic(fmt.Sprintf("解析 session.idle_ttl 失败: %v", err))
	}
	sessionMaxTTL, err := time.ParseDuration(v.GetString("session.max_ttl"))
	if err != nil {
		panic(fmt.Sprintf("解析 session.max_ttl 失败: %v", err))
	}

	bilibiliCookie := v.GetString("bilibili_cookies")

	connMaxLifetime, err := time.ParseDuration(v.GetString("database.conn_max_lifetime"))
	if err != nil {
		panic(fmt.Sprintf("解析 database.conn_max_lifetime 失败: %v", err))
	}

	cfg := &Config{
		Environment: v.GetString("environment"),
		Database: DatabaseConfig{
			Host:            v.GetString("database.host"),
			Port:            v.GetInt("database.port"),
			Name:            v.GetString("database.name"),
			User:            v.GetString("database.user"),
			Password:        v.GetString("database.password"),
			SSLMode:         v.GetString("database.sslmode"),
			MaxOpenConns:    v.GetInt("database.max_open_conns"),
			MaxIdleConns:    v.GetInt("database.max_idle_conns"),
			ConnMaxLifetime: connMaxLifetime,
		},
		Redis: RedisConfig{
			Host:     v.GetString("redis.host"),
			Port:     v.GetInt("redis.port"),
			DB:       v.GetInt("redis.db"),
			Password: v.GetString("redis.password"),
		},
		GoogleClientID:       v.GetString("google_client_id"),
		GithubClientID:       v.GetString("github_client_id"),
		GithubClientSecret:   v.GetString("github_client_secret"),
		ResendAPIKey:         v.GetString("resend_api_key"),
		EmailFrom:            v.GetString("email_from"),
		Port:                 v.GetString("port"),
		UploadPathPrefix:     v.GetString("upload_path_prefix"),
		UploadDir:            v.GetString("upload_dir"),
		BilibiliCookie:       bilibiliCookie,
		BilibiliAPIType:      v.GetString("bilibili_api_type"),
		KiteURL:              v.GetString("kite_url"),
		Cookie: CookieConfig{
			Domain:      v.GetString("cookie.domain"),
			Secure:      v.GetBool("cookie.secure"),
			SameSite:    v.GetString("cookie.samesite"),
			CSRFName:    v.GetString("cookie.csrf_name"),
			SessionName: v.GetString("cookie.session_name"),
		},
		Session: SessionConfig{
			IdleTTL: sessionIdleTTL,
			MaxTTL:  sessionMaxTTL,
		},
		CORSAllowedOrigins: getStringSlice(v, "cors_allowed_origins"),
		SuperAdmin: SuperAdminConfig{
			Enabled:  v.GetBool("superadmin.enabled"),
			Username: v.GetString("superadmin.username"),
			Email:    v.GetString("superadmin.email"),
			Password: v.GetString("superadmin.password"),
		},
		TrustedProxies: getStringSlice(v, "trusted_proxies"),
		CodeRunner: CodeRunnerConfig{
			Enabled:          v.GetBool("code_runner.enabled"),
			MaxCPUCores:      v.GetFloat64("code_runner.max_cpu_cores"),
			MaxMemoryMB:      v.GetUint64("code_runner.max_memory_mb"),
			MaxTimeoutSecs:   v.GetUint64("code_runner.max_timeout_secs"),
			MaxOutputBytes:   v.GetUint64("code_runner.max_output_bytes"),
			MaxSourceBytes:   v.GetUint64("code_runner.max_source_bytes"),
			AllowNetwork:     v.GetBool("code_runner.allow_network"),
			MaxConcurrent:    v.GetInt("code_runner.max_concurrent"),
			QueueTimeoutSecs: v.GetUint64("code_runner.queue_timeout_secs"),
			TaskTTLSecs:      v.GetUint64("code_runner.task_ttl_secs"),
			DockerSocketPath: v.GetString("code_runner.docker_socket_path"),
			Languages:        getStringSlice(v, "code_runner.languages"),
		},
	}

	// 验证必需配置
	if err := cfg.Validate(); err != nil {
		panic(fmt.Sprintf("配置验证失败: %v", err))
	}

	printConfigSources(v, preEnvKeys, dotenvKeys)

	return cfg
}

// Validate 验证配置的有效性
func (c *Config) Validate() error {
	// 数据库配置必须完整
	if c.Database.Host == "" {
		return fmt.Errorf("DATABASE_HOST 未配置")
	}
	if c.Database.Port == 0 {
		return fmt.Errorf("DATABASE_PORT 未配置")
	}
	if c.Database.Name == "" {
		return fmt.Errorf("DATABASE_NAME 未配置")
	}
	if c.Database.User == "" {
		return fmt.Errorf("DATABASE_USER 未配置")
	}

	// 生产环境必须配置数据库密码；SSL 模式可为 disable（内部 Docker 网络）或启用加密传输
	if c.Environment == "production" {
		if c.Database.Password == "" {
			return fmt.Errorf("生产环境必须配置 DATABASE_PASSWORD")
		}
		if c.Database.SSLMode != "disable" && c.Database.SSLMode != "require" && c.Database.SSLMode != "verify-ca" && c.Database.SSLMode != "verify-full" {
			return fmt.Errorf("生产环境 DATABASE_SSLMODE 必须为 disable、require、verify-ca 或 verify-full")
		}
	}

	// 连接池参数合理性校验（避免资源浪费或配置错误导致连接耗尽）
	if c.Database.MaxOpenConns <= 0 {
		return fmt.Errorf("database.max_open_conns 必须大于 0")
	}
	if c.Database.MaxIdleConns < 0 {
		return fmt.Errorf("database.max_idle_conns 不能为负数")
	}
	if c.Database.MaxIdleConns > c.Database.MaxOpenConns {
		return fmt.Errorf("database.max_idle_conns (%d) 不能大于 max_open_conns (%d)",
			c.Database.MaxIdleConns, c.Database.MaxOpenConns)
	}
	if c.Database.ConnMaxLifetime <= 0 {
		return fmt.Errorf("database.conn_max_lifetime 必须大于 0")
	}

	// Redis 配置必须完整
	if c.Redis.Host == "" {
		return fmt.Errorf("REDIS_HOST 未配置")
	}
	if c.Redis.Port == 0 {
		return fmt.Errorf("REDIS_PORT 未配置")
	}

	// Session 配置：idle 必须 > 0；max<=0 表示无上限
	if c.Session.IdleTTL <= 0 {
		return fmt.Errorf("session.idle_ttl 必须大于 0")
	}
	if c.Cookie.SessionName == "" {
		return fmt.Errorf("cookie.session_name 不能为空")
	}

	// Cookie 配置校验
	if c.Cookie.CSRFName == "" {
		return fmt.Errorf("cookie.csrf_name 不能为空")
	}
	switch strings.ToLower(c.Cookie.SameSite) {
	case "", "lax", "strict", "none":
		// 合法值
	default:
		return fmt.Errorf("cookie.samesite 必须为 lax/strict/none，当前: %s", c.Cookie.SameSite)
	}
	// SameSite=None 必须 Secure（现代浏览器强制），否则 Cookie 会被丢弃
	if strings.ToLower(c.Cookie.SameSite) == "none" && !c.Cookie.Secure {
		return fmt.Errorf("cookie.samesite=none 时必须 cookie.secure=true（HTTPS）")
	}

	// 生产环境安全校验
	if c.Environment == "production" {
		if !c.Cookie.Secure {
			return fmt.Errorf("生产环境必须 cookie.secure=true")
		}
		if len(c.CORSAllowedOrigins) == 0 {
			return fmt.Errorf("生产环境必须配置 CORS_ALLOWED_ORIGINS(且禁止使用通配符)")
		}
		// 拒绝 localhost 来源:生产落到 localhost 默认值说明 CORS_ALLOWED_ORIGINS 未显式配置
		for _, origin := range c.CORSAllowedOrigins {
			if strings.Contains(origin, "localhost") || strings.Contains(origin, "127.0.0.1") {
				return fmt.Errorf("生产环境 CORS_ALLOWED_ORIGINS 不能包含 localhost/127.0.0.1: %s", origin)
			}
		}
	}

	// 代码运行器配置校验（仅启用时检查上限合理性）
	if c.CodeRunner.Enabled {
		if c.CodeRunner.MaxCPUCores <= 0 {
			return fmt.Errorf("code_runner.max_cpu_cores 必须大于 0")
		}
		if c.CodeRunner.MaxMemoryMB == 0 {
			return fmt.Errorf("code_runner.max_memory_mb 必须大于 0")
		}
		if c.CodeRunner.MaxTimeoutSecs == 0 {
			return fmt.Errorf("code_runner.max_timeout_secs 必须大于 0")
		}
		if c.CodeRunner.MaxConcurrent <= 0 {
			return fmt.Errorf("code_runner.max_concurrent 必须大于 0")
		}
		if c.CodeRunner.DockerSocketPath == "" {
			return fmt.Errorf("code_runner.docker_socket_path 不能为空")
		}
	}

	return nil
}

// getStringSlice 读取字符串列表配置。
//
// viper 对 env 中的列表值按空白预切分(元素可能带逗号残留),对无空格逗号串又不切,
// 两种写法都兼容:逐元素再按逗号切分并去空白。
//   CORS_ALLOWED_ORIGINS=https://a.com,https://b.com   →  [a.com, b.com]
//   CORS_ALLOWED_ORIGINS="https://a.com, https://b.com" →  [a.com, b.com]
func getStringSlice(v *viper.Viper, key string) []string {
	raw := v.GetStringSlice(key)
	var out []string
	for _, item := range raw {
		for _, part := range strings.Split(item, ",") {
			if p := strings.TrimSpace(part); p != "" {
				out = append(out, p)
			}
		}
	}
	return out
}

// currentEnvKeys 返回当前进程环境变量名集合(godotenv 加载前调用,用于区分 env 与 .env 来源)
func currentEnvKeys() map[string]bool {
	m := make(map[string]bool, 64)
	for _, kv := range os.Environ() {
		if i := strings.IndexByte(kv, '='); i > 0 {
			m[kv[:i]] = true
		}
	}
	return m
}

// readDotenvKeys 解析根 .env 的变量名集合(不注入进程,仅用于来源标注)
func readDotenvKeys() map[string]bool {
	m := map[string]bool{}
	// 逐文件读取:任一文件不存在时 godotenv.Read 返回 error 且放弃全部结果,须忽略单文件错误
	for _, f := range []string{"../.env", ".env"} {
		if kv, err := godotenv.Read(f); err == nil {
			for k := range kv {
				m[k] = true
			}
		}
	}
	return m
}

// sensitiveKeyParts 键名中出现这些片段时,打印值一律脱敏
// 注意用复数 cookies:单数 cookie 会误伤 cookie.csrf_name 等非敏感键
var sensitiveKeyParts = []string{"password", "secret", "cookies", "token", "api_key"}

// printConfigSources 打印全部配置项的最终值(脱敏)与来源。
//
// 回答「启动时读的到底是哪个配置」:每一项标注来自进程环境变量(env)、
// 根 .env 文件(.env)、config.yaml(yaml)还是代码默认值(default)。
// 输出到 stderr:此时 zerolog 尚未初始化,且容器日志可直接采集。
//
// 用 text/tabwriter 自动对齐列宽(避免固定 %-32s 被长键撑破),
// 并按来源分组(env → .env → yaml → default),让「哪些键被显式覆盖、
// 哪些走了默认」一眼可读。
func printConfigSources(v *viper.Viper, preEnv, dotenv map[string]bool) {
	keys := v.AllKeys()
	slices.Sort(keys)

	type item struct {
		key, masked, source string
	}
	items := make([]item, 0, len(keys))
	counts := map[string]int{}
	for _, key := range keys {
		envName := strings.ToUpper(strings.ReplaceAll(key, ".", "_"))
		source := "default"
		switch {
		case preEnv[envName]:
			source = "env"
		case dotenv[envName]:
			source = ".env"
		case v.InConfig(key):
			source = "yaml"
		}
		counts[source]++
		items = append(items, item{key, maskValue(key, v.Get(key)), source})
	}

	// 按来源分组:被覆盖的(env/.env/yaml)在前,默认值(default)在后;
	// 组内按键名字典序,保证多次启动输出稳定、可 diff。
	sourceRank := map[string]int{"env": 0, ".env": 1, "yaml": 2, "default": 3}
	slices.SortFunc(items, func(a, b item) int {
		if r := sourceRank[a.source] - sourceRank[b.source]; r != 0 {
			return r
		}
		return strings.Compare(a.key, b.key)
	})

	// tabwriter:最小列宽 0(按内容自适应),padding 2,无填充符对齐。
	// 走 stderr,格式 `  KEY\t = VALUE\t [SOURCE]`。
	w := tabwriter.NewWriter(os.Stderr, 0, 0, 2, ' ', 0)
	fmt.Fprintf(w, "配置加载: %d 项\t  env=%d  .env=%d  yaml=%d  default=%d\n\n",
		len(keys), counts["env"], counts[".env"], counts["yaml"], counts["default"])

	prevSource := ""
	for _, it := range items {
		// 来源切换时打分组标题,视觉分隔
		if it.source != prevSource {
			if prevSource != "" {
				fmt.Fprintln(w)
			}
			fmt.Fprintf(w, "  [%s]\n", it.source)
			prevSource = it.source
		}
		fmt.Fprintf(w, "    %s\t = %s\n", it.key, it.masked)
	}
	_ = w.Flush()
}

// maskValue 脱敏敏感配置值;非敏感值原样返回,空值标注 (empty)
func maskValue(key string, value any) string {
	s := fmt.Sprintf("%v", value)
	if s == "" {
		return "(empty)"
	}
	lk := strings.ToLower(key)
	for _, p := range sensitiveKeyParts {
		if strings.Contains(lk, p) {
			return "***"
		}
	}
	return s
}
