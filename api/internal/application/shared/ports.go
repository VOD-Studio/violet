// Package shared 定义应用层端口（基础设施接口），保持 application 层零框架依赖。
//
// 本文件抽取 auth 模块的基础设施端口（CodeStore/SessionStore），
// 使 application/auth/command 不再直接 import infrastructure/auth 具体类型。
package shared

import (
	"context"
	"time"

	"blog-api/internal/domain/opsgrant"
	domainsession "blog-api/internal/domain/session"
)

// CodeStore 验证码存储端口
type CodeStore interface {
	Store(ctx context.Context, prefix, identifier, codeHash string) error
	Verify(ctx context.Context, prefix, identifier, codeHash string) (bool, error)
}

// OpsGrantStore 短时运维授权存储端口。
//
// 授权绑定 (用户, 会话, 类别)，超时由存储 TTL 兜底失效；退出、改密、
// 会话吊销与撤权路径必须同步调用 Revoke* 立即失效。
type OpsGrantStore interface {
	// Issue 写入授权，覆盖同键旧授权并重置 TTL。
	Issue(ctx context.Context, grant opsgrant.Grant) error
	// Exists 判断指定用户/会话/类别的授权当前是否有效。
	Exists(ctx context.Context, userID, sessionID string, category opsgrant.Category) (bool, error)
	// RevokeSession 吊销指定 session 的全部类别授权。
	RevokeSession(ctx context.Context, userID, sessionID string) error

	// RevokeAll 吊销全部运维授权（角色权限矩阵变更时整体失效：
	// 授权签发时依据的权限集可能已不成立）。
	RevokeAll(ctx context.Context) error
	// RevokeUser 吊销指定用户的全部授权。
	RevokeUser(ctx context.Context, userID string) error
}

// SessionStore opaque session 存储端口。
//
// 命门不变量②：Touch 只滑动续期（重置 TTL + 更新 lastSeenAt），不轮换 id、
// 不产生 Set-Cookie。一旦轮换 id 就要在 SSR 写 cookie，重新撞 server function
// 吞 Set-Cookie 的卡点。
type SessionStore interface {
	// Create 写入新 session，TTL=idleTTL，同时登记到 user:<uid>:sessions 索引。
	Create(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration) error
	// CreateBounded 在并发上限内原子创建：清理过期索引、按创建时间淘汰最旧
	// 有效会话再写入。maxDevices<=0 不限制。返回被淘汰的 session id。
	CreateBounded(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration, maxDevices int) ([]string, error)
	// Get 读取并反序列化，不续期。不存在或已过期返回 session.ErrSessionNotFound。
	Get(ctx context.Context, id domainsession.ID) (*domainsession.Session, error)
	// Touch 滑动续期：重置 TTL=idleTTL 并更新 lastSeenAt 与客户端信息，
	// 不换 id、不产生 cookie；session 已被吊销时返回 ErrSessionNotFound。
	Touch(ctx context.Context, sess *domainsession.Session, idleTTL time.Duration, client domainsession.ClientContext) error
	// DeleteForUser 删除指定用户的指定 session（登出当前设备），同步清理索引。
	DeleteForUser(ctx context.Context, userID string, id domainsession.ID) error
	// DeleteByUser 删除某用户全部 session（改密/重置密码强制全部设备重登）。
	DeleteByUser(ctx context.Context, userID string) error
	// ListByUser 返回该用户全部仍存活的 session（按创建时间升序），供设备列表
	// 与吊销前属主校验使用。
	ListByUser(ctx context.Context, userID string) ([]*domainsession.Session, error)
	// MigrateLegacyIndexes 将升级前的 SET 索引转换为 ZSET，进程启动时调用一次。
	MigrateLegacyIndexes(ctx context.Context, idleTTL time.Duration) error
}
