// Package shared 定义应用层端口（基础设施接口），保持 application 层零框架依赖。
//
// 本文件抽取 auth 模块的基础设施端口（CodeStore/SessionStore），
// 使 application/auth/command 不再直接 import infrastructure/auth 具体类型。
package shared

import (
	"context"
	"time"

	domainsession "blog-api/internal/domain/session"
)

// CodeStore 验证码存储端口
type CodeStore interface {
	Store(ctx context.Context, prefix, identifier, codeHash string) error
	Verify(ctx context.Context, prefix, identifier, codeHash string) (bool, error)
}

// SessionStore opaque session 存储端口。
//
// 命门不变量②：Touch 只滑动续期（重置 TTL + 更新 lastSeenAt），不轮换 id、
// 不产生 Set-Cookie。一旦轮换 id 就要在 SSR 写 cookie，重新撞 server function
// 吞 Set-Cookie 的卡点。
type SessionStore interface {
	// Create 写入新 session，TTL=idleTTL，同时登记到 user:<uid>:sessions 索引。
	Create(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration) error
	// Get 读取并反序列化，不续期。不存在或已过期返回 session.ErrSessionNotFound。
	Get(ctx context.Context, id domainsession.ID) (*domainsession.Session, error)
	// Touch 滑动续期：重置 TTL=idleTTL 并更新 lastSeenAt，不换 id、不产生 cookie。
	Touch(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration) error
	// DeleteForUser 删除指定用户的指定 session（登出当前设备），同步清理索引。
	DeleteForUser(ctx context.Context, userID string, id domainsession.ID) error
	// DeleteByUser 删除某用户全部 session（改密/重置密码强制全部设备重登）。
	DeleteByUser(ctx context.Context, userID string) error
}
