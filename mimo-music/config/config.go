// Package config 定义 mimo-music 服务的配置结构。
//
// 配置通过 yaml 文件加载，环境变量可覆盖字段值。
// 后续 issue 会把配置拆成 server / provider / redis / worker 模块化文件。
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config 是 mimo-music 服务的顶层配置。
//
// 当前只含最小字段（端口、环境），后续 issue 会扩展。
type Config struct {
	// Server 是 HTTP 服务相关配置。
	Server ServerConfig
}

// ServerConfig 是 HTTP 服务相关配置。
type ServerConfig struct {
	// Port 是 HTTP 服务监听端口。
	Port int

	// Env 是运行环境（dev / prod）。
	//
	// dev 环境用彩色文本日志，prod 环境用 JSON 日志。
	Env string
}

// Default 返回默认配置。
func Default() Config {
	return Config{
		Server: ServerConfig{
			Port: 8080,
			Env:  "dev",
		},
	}
}

// Load 从环境变量加载配置，覆盖默认值。
//
// 当前支持的覆盖项：
//   - MIMO_MUSIC_SERVER_PORT：服务端口
//   - MIMO_MUSIC_SERVER_ENV：运行环境
func Load() Config {
	cfg := Default()

	if v := os.Getenv("MIMO_MUSIC_SERVER_PORT"); v != "" {
		if port, err := strconv.Atoi(v); err == nil {
			cfg.Server.Port = port
		}
	}

	if v := os.Getenv("MIMO_MUSIC_SERVER_ENV"); v != "" {
		cfg.Server.Env = strings.ToLower(v)
	}

	return cfg
}

// String 返回配置摘要，用于启动日志。
func (c Config) String() string {
	return fmt.Sprintf("env=%s port=%d", c.Server.Env, c.Server.Port)
}
