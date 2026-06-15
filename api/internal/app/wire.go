//go:build wireinject
// +build wireinject

// Package app 提供应用层依赖注入装配（基于 google/wire）。
//
// 当前阶段（P1）只装配新 DDD user 模块，与 cmd/server/main.go 中的
// 旧手工 DI 并存。P2 模块迁移时，旧 service 逐步搬入 wire provider set，
// 最终 main.go 只保留 config.Load + log.Init + wire 调用。
//
// wire 生成代码在 wire_gen.go（勿手改）。重新生成：
//
//	wire ./internal/app/
//	# 或: make wire
package app

import (
	"github.com/google/wire"
	"gorm.io/gorm"

	"blog-api/internal/application/shared"
	"blog-api/internal/application/user/command"
	"blog-api/internal/domain/user"
	infraeventbus "blog-api/internal/infrastructure/eventbus"
	gormrepo "blog-api/internal/infrastructure/persistence/gorm"
	userhttp "blog-api/internal/interfaces/http/handler/user"
)

// ============================================================
// Provider Sets（按层分组，便于组合）
// ============================================================

// InfrastructureSet 基础设施层 provider 集合
//
// 提供 GORM repository、事件总线、密码哈希器等基础设施实现。
// 注意：*gorm.DB 由 main.go 现有代码初始化后注入（wire 不负责创建 DB 连接，
// 因为连接池配置、ping、迁移都在 main.go 中执行）。
var InfrastructureSet = wire.NewSet(
	// 事件总线
	infraeventbus.NewInMemory,
	// 绑定接口
	wire.Bind(new(shared.EventBus), new(*infraeventbus.InMemory)),

	// 密码哈希器
	command.NewBcryptHasher,
	wire.Bind(new(command.PasswordHasher), new(*command.BcryptHasher)),
)

// UserDomainSet user 聚合的 repository provider
//
// *gorm.DB 由调用方（main.go）注入，wire 在此绑定接口实现。
var UserDomainSet = wire.NewSet(
	gormrepo.NewUserRepository,
	wire.Bind(new(user.UserRepository), new(*gormrepo.UserRepository)),
)

// UserApplicationSet user 聚合的 application 层（用例）provider
var UserApplicationSet = wire.NewSet(
	command.NewRegisterUserHandler,
)

// UserInterfacesSet user 聚合的 interfaces 层（HTTP handler）provider
var UserInterfacesSet = wire.NewSet(
	userhttp.NewHandler,
)

// ============================================================
// 注入入口
// ============================================================

// UserContainer user 模块依赖容器
//
// 聚合 user 模块的所有依赖（repository、用例、handler），
// 由 main.go 通过 InitializeUserContainer 获取后注册路由。
type UserContainer struct {
	RegisterHandler *command.RegisterUserHandler
	UserHandler     *userhttp.Handler
}

// InitializeUserContainer 装配 user 模块依赖图
//
// 参数 db 由 main.go 注入（已配置连接池、已执行迁移）。
// wire 据此自动生成依赖图，编译期校验完整性。
func InitializeUserContainer(db *gorm.DB) (*UserContainer, func(), error) {
	wire.Build(
		InfrastructureSet,
		UserDomainSet,
		UserApplicationSet,
		UserInterfacesSet,
		newUserContainer,
	)
	return nil, nil, nil // wire 填充
}

// newUserContainer 构造容器（wire 使用）
func newUserContainer(
	registerHandler *command.RegisterUserHandler,
	userHandler *userhttp.Handler,
) *UserContainer {
	return &UserContainer{
		RegisterHandler: registerHandler,
		UserHandler:     userHandler,
	}
}
