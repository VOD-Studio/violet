package config

import (
	"os"
	"strconv"
	"time"
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
}

// Load 从环境变量加载配置，未设置时使用默认值
func Load() *Config {
	accessTokenTTL := getEnvAsDuration("JWT_ACCESS_TOKEN_TTL", 15*time.Minute)
	refreshTokenTTL := getEnvAsDuration("JWT_REFRESH_TOKEN_TTL", 7*24*time.Hour)

	return &Config{
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://blog:blog123@localhost:5432/blog?sslmode=disable"),
		RedisURL:           getEnv("REDIS_URL", "redis://localhost:6379/0"),
		JWTPrivateKeyPath:  getEnv("JWT_PRIVATE_KEY_PATH", ""),
		JWTPublicKeyPath:   getEnv("JWT_PUBLIC_KEY_PATH", ""),
		JWTAccessTokenTTL:  accessTokenTTL,
		JWTRefreshTokenTTL: refreshTokenTTL,
		ResendAPIKey:       getEnv("RESEND_API_KEY", ""),
		EmailFrom:          getEnv("EMAIL_FROM", "noreply@yourdomain.com"),
		FrontendURL:        getEnv("FRONTEND_URL", "http://localhost:3000"),
		Port:               getEnv("PORT", "8080"),
	}
}

// getEnv 读取环境变量，若未设置则返回默认值
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// getEnvAsDuration 读取环境变量并解析为时间间隔，若未设置或解析失败则返回默认值
func getEnvAsDuration(key string, fallback time.Duration) time.Duration {
	if value, ok := os.LookupEnv(key); ok {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return fallback
}

// getEnvAsInt 读取环境变量并解析为整数，若未设置或解析失败则返回默认值
func getEnvAsInt(key string, fallback int) int {
	if value, ok := os.LookupEnv(key); ok {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return fallback
}
