// Package gallery 提供图集工作稿的应用用例。
package gallery

import (
	"context"
	"time"

	domaingallery "blog-api/internal/domain/gallery"
	"blog-api/internal/domain/shared"
)

// Asset 是图集用例从媒体域读取的最小素材投影。
type Asset struct {
	// ID 素材 ID。
	ID shared.ID
	// OwnerID 素材所有者 ID。
	OwnerID shared.ID
	// URL 原图访问地址。
	URL string
	// Thumbnail 缩略图访问地址。
	Thumbnail string
	// MimeType 素材 MIME 类型。
	MimeType string
	// Status 素材处理状态。
	Status string
	// Width 图片宽度；未知为 0。
	Width int
	// Height 图片高度；未知为 0。
	Height int
	// AltText 素材库默认无障碍描述。
	AltText string
	// DeletedAt 素材软删除时间；nil 表示未删除。
	DeletedAt *time.Time
}

// AssetStore 是 Gallery 与媒体域之间的 application seam。
type AssetStore interface {
	// FindByIDs 批量读取素材，不加写锁。
	FindByIDs(ctx context.Context, ids []shared.ID) ([]Asset, error)
	// FindByIDsForUpdate 批量读取并锁定素材行，防止保存事务期间状态漂移。
	FindByIDsForUpdate(ctx context.Context, ids []shared.ID) ([]Asset, error)
	// UpdateRefCount 在当前事务中调整素材引用计数。
	UpdateRefCount(ctx context.Context, id shared.ID, delta int) error
}

// Transaction 暴露同一个数据库事务中的图集与素材 adapter。
type Transaction interface {
	Galleries() domaingallery.Repository
	Assets() AssetStore
}

// UnitOfWork 保证工作稿、revision items 与素材引用计数同事务提交。
type UnitOfWork interface {
	Do(ctx context.Context, fn func(Transaction) error) error
}

// PermissionChecker 权限检查端口（避免直接依赖 permission application 包）。
type PermissionChecker interface {
	HasPermission(role string, isBuiltinSuperAdmin bool, codes ...string) bool
}

// UserDirectory 是 Gallery 与用户域之间的最小读取 seam。
type UserDirectory interface {
	// FindIDByUsername 精确匹配用户名；未命中返回 found=false，不视为错误。
	FindIDByUsername(ctx context.Context, username string) (id shared.ID, found bool, err error)
	// DisplayNamesByIDs 批量读取用户可读名（display_name 优先，缺省 username）；
	// 不存在的 ID 不出现在结果里。
	DisplayNamesByIDs(ctx context.Context, ids []shared.ID) (map[shared.ID]string, error)
}
