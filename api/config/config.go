package config

import (
	"fmt"
	"net/http"
	"strings"
	"time"

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
	// JWTPrivateKeyPath JWT ES256 私钥文件路径（PEM 格式）
	JWTPrivateKeyPath string
	// JWTPublicKeyPath JWT ES256 公钥文件路径（PEM 格式）
	JWTPublicKeyPath string
	// JWTAccessTokenTTL JWT 访问令牌过期时间
	JWTAccessTokenTTL time.Duration
	// JWTRefreshTokenTTL JWT 刷新令牌过期时间
	JWTRefreshTokenTTL time.Duration
	// ResendAPIKey Resend 件服务 API 密钥
	ResendAPIKey string
	// EmailFrom 发件人邮箱地址
	EmailFrom string
	// FrontendURL 前端应用地址，用于邮件中的链接
	FrontendURL string
	// Port 服务监听端口
	Port string
	// UploadPathPrefix 上传文件路径前缀，如 "/uploads/"
	UploadPathPrefix string
	// BilibiliCookie B站登录 Cookie，用于获取表情种子数据（自动拼接）
	BilibiliCookie string
	// BilibiliAPIType B站表情 API 类型：user(用户收藏) 或 official(官方)
	BilibiliAPIType string
	// Cookie 鉴权 Cookie 配置（access/refresh token 通过 HttpOnly Cookie 下发）
	Cookie CookieConfig
	// CORSAllowedOrigins 允许的前端来源列表（用于跨域 Cookie 与 CSRF 防护）
	// 生产环境通过 CORS_ALLOWED_ORIGINS 环境变量覆盖
	CORSAllowedOrigins []string
	// SuperAdmin 超级管理员配置
	SuperAdmin SuperAdminConfig
	// TrustedProxies 受信代理 CIDR 列表（如 Nginx/CDN 出口 IP）。
	// 非空时，仅当 RemoteAddr 命中此列表才信任 X-Forwarded-For/X-Real-IP；
	// 为空时一律使用 RemoteAddr，拒绝任何客户端自报的转发头（防 IP 欺骗绕过限流）。
	TrustedProxies []string
}

// CookieConfig 鉴权 Cookie 配置
//
// access 与 refresh token 均通过 HttpOnly Cookie 下发，避免 JS 读取（防 XSS 偷取）。
// 由此带来的 CSRF 风险通过 double-submit cookie 中间件防护（见 middleware/csrf.go）。
type CookieConfig struct {
	// Domain Cookie 的 Domain 属性
	// 开发环境留空（默认为当前 host）；生产环境填站点主域名（如 example.com）以支持子域共享
	Domain string
	// Secure Cookie 的 Secure 属性
	// true 时仅 HTTPS 才下发；开发环境（HTTP localhost）必须为 false
	Secure bool
	// SameSite Cookie 的 SameSite 属性：lax（默认，兼顾安全与可用）/ strict / none
	// 注意：跨域开发（localhost:5173 → api:8080）必须为 none+secure，否则浏览器拒收
	SameSite string
	// AccessName access token Cookie 名
	AccessName string
	// RefreshName refresh token Cookie 名
	RefreshName string
	// CSRFName CSRF double-submit Cookie 名（非 HttpOnly，供前端读取回传）
	CSRFName string
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

// Load 从配置文件和环境变量加载配置
// 优先级：环境变量 > config.yaml > 默认值
// 如果必需配置缺失或格式错误，会 panic
func Load() *Config {
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
	v.SetDefault("jwt_private_key_path", "")
	v.SetDefault("jwt_public_key_path", "")
	v.SetDefault("jwt_access_token_ttl", "15m")
	v.SetDefault("jwt_refresh_token_ttl", "168h")
	v.SetDefault("resend_api_key", "")
	v.SetDefault("email_from", "noreply@yourdomain.com")
	v.SetDefault("frontend_url", "http://localhost:3000")
	v.SetDefault("port", "8080")
	v.SetDefault("upload_path_prefix", "/uploads/")
	v.SetDefault("bilibili_sessdata", "")
	v.SetDefault("bilibili_bili_jct", "")
	v.SetDefault("bilibili_dedeuserid", "")
	v.SetDefault("bilibili_api_type", "user")
	// Cookie 默认值：开发环境友好（HTTP、lax、空 domain）
	// 生产环境必须通过 COOKIE_SECURE=true、COOKIE_DOMAIN、CORS_ALLOWED_ORIGINS 覆盖
	v.SetDefault("cookie.domain", "")
	v.SetDefault("cookie.secure", false)
	v.SetDefault("cookie.samesite", "lax")
	v.SetDefault("cookie.access_name", "mimo_access")
	v.SetDefault("cookie.refresh_name", "mimo_refresh")
	v.SetDefault("cookie.csrf_name", "mimo_csrf")
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

	// 读取配置文件（不存在也不报错）
	_ = v.ReadInConfig()

	// 解析时间配置，如果格式错误则 panic
	accessTokenTTL, err := time.ParseDuration(v.GetString("jwt_access_token_ttl"))
	if err != nil {
		panic(fmt.Sprintf("解析 JWT_ACCESS_TOKEN_TTL 失败: %v", err))
	}
	refreshTokenTTL, err := time.ParseDuration(v.GetString("jwt_refresh_token_ttl"))
	if err != nil {
		panic(fmt.Sprintf("解析 JWT_REFRESH_TOKEN_TTL 失败: %v", err))
	}

	bilibiliCookie := buildBilibiliCookie(
		v.GetString("bilibili_sessdata"),
		v.GetString("bilibili_bili_jct"),
		v.GetString("bilibili_dedeuserid"),
	)

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
		JWTPrivateKeyPath:  v.GetString("jwt_private_key_path"),
		JWTPublicKeyPath:   v.GetString("jwt_public_key_path"),
		JWTAccessTokenTTL:  accessTokenTTL,
		JWTRefreshTokenTTL: refreshTokenTTL,
		ResendAPIKey:       v.GetString("resend_api_key"),
		EmailFrom:          v.GetString("email_from"),
		FrontendURL:        v.GetString("frontend_url"),
		Port:               v.GetString("port"),
		UploadPathPrefix:   v.GetString("upload_path_prefix"),
		BilibiliCookie:     bilibiliCookie,
		BilibiliAPIType:    v.GetString("bilibili_api_type"),
		Cookie: CookieConfig{
			Domain:      v.GetString("cookie.domain"),
			Secure:      v.GetBool("cookie.secure"),
			SameSite:    v.GetString("cookie.samesite"),
			AccessName:  v.GetString("cookie.access_name"),
			RefreshName: v.GetString("cookie.refresh_name"),
			CSRFName:    v.GetString("cookie.csrf_name"),
		},
		CORSAllowedOrigins: v.GetStringSlice("cors_allowed_origins"),
		SuperAdmin: SuperAdminConfig{
			Enabled:  v.GetBool("superadmin.enabled"),
			Username: v.GetString("superadmin.username"),
			Email:    v.GetString("superadmin.email"),
			Password: v.GetString("superadmin.password"),
		},
		TrustedProxies: v.GetStringSlice("trusted_proxies"),
	}

	// 验证必需配置
	if err := cfg.Validate(); err != nil {
		panic(fmt.Sprintf("配置验证失败: %v", err))
	}

	return cfg
}

// Validate 验证配置的有效性
func (c *Config) Validate() error {
	// JWT 密钥路径必须配置
	if c.JWTPrivateKeyPath == "" {
		return fmt.Errorf("JWT_PRIVATE_KEY_PATH 未配置")
	}
	if c.JWTPublicKeyPath == "" {
		return fmt.Errorf("JWT_PUBLIC_KEY_PATH 未配置")
	}

	// 数据库配置必须完整
	if c.Database.Host == "" {
		return fmt.Errorf("DB_HOST 未配置")
	}
	if c.Database.Port == 0 {
		return fmt.Errorf("DB_PORT 未配置")
	}
	if c.Database.Name == "" {
		return fmt.Errorf("DB_NAME 未配置")
	}
	if c.Database.User == "" {
		return fmt.Errorf("DB_USER 未配置")
	}

	// 生产环境必须配置数据库密码；SSL 模式可为 disable（内部 Docker 网络）或启用加密传输
	if c.Environment == "production" {
		if c.Database.Password == "" {
			return fmt.Errorf("生产环境必须配置 DB_PASSWORD")
		}
		if c.Database.SSLMode != "disable" && c.Database.SSLMode != "require" && c.Database.SSLMode != "verify-ca" && c.Database.SSLMode != "verify-full" {
			return fmt.Errorf("生产环境 DB_SSLMODE 必须为 disable、require、verify-ca 或 verify-full")
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

	// Token TTL 必须大于 0
	if c.JWTAccessTokenTTL <= 0 {
		return fmt.Errorf("JWT_ACCESS_TOKEN_TTL 必须大于 0")
	}
	if c.JWTRefreshTokenTTL <= 0 {
		return fmt.Errorf("JWT_REFRESH_TOKEN_TTL 必须大于 0")
	}

	// Cookie 配置校验
	if c.Cookie.AccessName == "" || c.Cookie.RefreshName == "" || c.Cookie.CSRFName == "" {
		return fmt.Errorf("cookie.access_name / refresh_name / csrf_name 均不能为空")
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
			return fmt.Errorf("生产环境必须配置 CORS_ALLOWED_ORIGINS（且禁止使用通配符）")
		}
	}

	return nil
}

// buildBilibiliCookie 从三个独立字段拼接 B站 Cookie
func buildBilibiliCookie(sessdata, biliJct, dedeUserID string) string {
	if sessdata == "" {
		return ""
	}
	cookie := "SESSDATA=" + sessdata
	if biliJct != "" {
		cookie += "; bili_jct=" + biliJct
	}
	if dedeUserID != "" {
		cookie += "; DedeUserID=" + dedeUserID
	}
	return cookie
}
