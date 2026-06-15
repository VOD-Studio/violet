package shared

import (
	"context"
)

// UnitOfWork 工作单元端口
//
// 封装事务边界：在单个事务中协调多个 repository 的写操作，
// 保证聚合内的强一致性（要么全部成功，要么全部回滚）。
//
// 设计意图：替代当前散落在 service 中的 db.BeginTx + queries.WithTx 模式，
// 统一事务管理入口，避免事务泄漏。
//
// 注意：本接口不感知具体 ORM，TxContext 通过闭包回调传递事务资源，
// 由 app 层（wire 装配）桥接具体实现（如 GORM）。
type UnitOfWork interface {
	// Do 在事务中执行 fn
	// fn 返回 nil 则提交，返回 error 则回滚
	// fn 的入参 TxContext 提供事务化的资源访问
	Do(ctx context.Context, fn func(tx TxContext) error) error
}

// TxContext 事务上下文
//
// 抽象表示"事务内的资源访问入口"。
// 具体资源（如 *gorm.DB）由 app 层在 wire 装配时注入 repository 工厂，
// application 层只通过此抽象感知"我在事务内"。
//
// 为保持 application 层零框架依赖，此处仅定义语义，
// 实际资源获取由 app 层用闭包捕获实现（见 app/tx_adapter.go）。
type TxContext interface {
	// Marker 仅作为类型标记，具体方法由实现补充
	isTxContext()
}
