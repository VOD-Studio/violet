// Package bootstrap 提供 mimo-music 的共享依赖注入装配。
//
// 本文件包含 wire injector 声明，go:build wireinject 标签确保只在
// wire 代码生成时编译。运行时用 wire_gen.go 中的生成代码。

//go:build wireinject

package bootstrap

import (
	"github.com/google/wire"

	"github.com/VOD-Studio/mimo-music/config"
	"github.com/VOD-Studio/mimo-music/internal/server"
	"github.com/VOD-Studio/mimo-music/internal/server/handler"
)

// InitializeServer 用 wire 装配 HTTP 服务组件。
func InitializeServer(cfg config.Config) (*ServerApp, error) {
	wire.Build(
		InfraSet,
		ProviderSet,
		ServiceSet,
		handler.New,
		server.NewRouter,
		NewServerApp,
	)
	return nil, nil
}
