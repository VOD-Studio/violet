// Package persona 提供人设档案管理与公开读取用例。
package persona

import (
	"context"
	"time"

	domainpersona "blog-api/internal/domain/persona"
	"blog-api/internal/domain/shared"
)

// Asset 是人设用例从媒体域读取的最小素材投影。
type Asset struct {
	// ID 素材 ID。
	ID shared.ID
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

// AssetStore 是 Persona 与媒体域之间的应用接缝。
type AssetStore interface {
	// FindByIDs 批量读取素材，不加写锁。
	FindByIDs(ctx context.Context, ids []shared.ID) ([]Asset, error)
	// FindByIDsForUpdate 批量读取并锁定素材行。
	FindByIDsForUpdate(ctx context.Context, ids []shared.ID) ([]Asset, error)
	// UpdateRefCount 在当前事务中调整素材引用计数。
	UpdateRefCount(ctx context.Context, id shared.ID, delta int) error
}

// Transaction 暴露同一数据库事务中的人设与素材 adapter。
type Transaction interface {
	Personas() domainpersona.Repository
	Assets() AssetStore
}

// UnitOfWork 保证档案、设定图、当前选择与素材引用计数同事务提交。
type UnitOfWork interface {
	Do(ctx context.Context, fn func(Transaction) error) error
}
