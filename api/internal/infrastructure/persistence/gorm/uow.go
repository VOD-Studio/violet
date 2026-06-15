// Package gorm 提供 GORM 持久化实现：repository 与 Unit of Work。
package gorm

import (
	"context"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// UnitOfWork GORM 工作单元实现
//
// 实现应用层 application/shared.UnitOfWork 端口。
// 封装 *gorm.DB 事务：应用层通过 Do 方法传入业务函数，
// 函数内通过 tx.DB() 获取事务化的 *gorm.DB 重建 repository，
// 保证多表写操作在同一事务内。
//
// 提交/回滚由本实现自动管理，应用层无需关心事务边界。
type UnitOfWork struct {
	db *gorm.DB
}

// NewUnitOfWork 创建 GORM 工作单元
func NewUnitOfWork(db *gorm.DB) *UnitOfWork {
	return &UnitOfWork{db: db}
}

// Do 在事务中执行 fn
//
// fn 接收一个返回 *gorm.DB 的回调函数，调用方在回调内用它创建事务化的 repository：
//
//	err := uow.Do(ctx, func(txDB *gorm.DB) error {
//	    userRepo := gorm.NewUserRepository(txDB)
//	    // 在同一事务内操作 user 和 role...
//	    return nil
//	})
//
// 此处不直接依赖 application/shared.TxContext（避免基础设施层依赖应用层），
// 而是返回 *gorm.DB 让调用方自由构造 repository。
// application/shared.UnitOfWork 接口由应用层适配本实现（见 app/wire.go 适配器）。
//
// 行为：
//   - fn 返回 nil → 提交事务
//   - fn 返回 error → 回滚事务并返回该 error
func (uow *UnitOfWork) Do(ctx context.Context, fn func(tx *gorm.DB) error) error {
	return uow.db.WithContext(ctx).Transaction(fn)
}

// 集成自检（开发期）：打印初始化日志，便于排障
func init() {
	log.Debug().Msg("GORM UnitOfWork 已初始化")
}
