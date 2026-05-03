package config

import (
	"strings"
	"time"

	"github.com/spf13/viper"
)

// Config 应用配置结构体，集中管理所有配置项
type Config struct {
	// DatabaseURL PostgreSQL 数据库连接地址
	DatabaseURL string
	// RedisURL Redis 连接地址
	RedisURL string
	// JWTPrivateKeyPath JWT ES256 私钥文件路径（PEM 格式）
	JWTPrivateKeyPath string
	// JWTPublicKeyPath JWT ES256 公钥文件路径（PEM 格式）
	JWTPublicKeyPath string
	// JWTAccessTokenTTL JWT 访问令牌过期时间
	JWTAccessTokenTTL time.Duration
	// JWTRefreshTokenTTL JWT 刷新令牌过期时间
	JWTRefreshTokenTTL time.Duration
	// ResendAPIKey Resend 邮件服务 API 密钥
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
	// SuperAdmin 超级管理员配置
	SuperAdmin SuperAdminConfig
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
	v.SetDefault("database_url", "postgres://blog:blog123@localhost:5432/blog?sslmode=disable")
	v.SetDefault("redis_url", "redis://localhost:6379/0")
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
	v.SetDefault("superadmin.enabled", false)
	v.SetDefault("superadmin.username", "admin")
	v.SetDefault("superadmin.email", "admin@example.com")
	v.SetDefault("superadmin.password", "")

	// 读取配置文件（不存在也不报错）
	_ = v.ReadInConfig()

	accessTokenTTL, _ := time.ParseDuration(v.GetString("jwt_access_token_ttl"))
	refreshTokenTTL, _ := time.ParseDuration(v.GetString("jwt_refresh_token_ttl"))

	bilibiliCookie := buildBilibiliCookie(
		v.GetString("bilibili_sessdata"),
		v.GetString("bilibili_bili_jct"),
		v.GetString("bilibili_dedeuserid"),
	)

	return &Config{
		DatabaseURL:       v.GetString("database_url"),
		RedisURL:          v.GetString("redis_url"),
		JWTPrivateKeyPath: v.GetString("jwt_private_key_path"),
		JWTPublicKeyPath:  v.GetString("jwt_public_key_path"),
		JWTAccessTokenTTL: accessTokenTTL,
		JWTRefreshTokenTTL: refreshTokenTTL,
		ResendAPIKey:      v.GetString("resend_api_key"),
		EmailFrom:         v.GetString("email_from"),
		FrontendURL:       v.GetString("frontend_url"),
		Port:              v.GetString("port"),
		UploadPathPrefix:  v.GetString("upload_path_prefix"),
		BilibiliCookie:    bilibiliCookie,
		SuperAdmin: SuperAdminConfig{
			Enabled:  v.GetBool("superadmin.enabled"),
			Username: v.GetString("superadmin.username"),
			Email:    v.GetString("superadmin.email"),
			Password: v.GetString("superadmin.password"),
		},
	}
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
