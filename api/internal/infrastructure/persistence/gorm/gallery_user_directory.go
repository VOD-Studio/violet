package gorm

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// GalleryUserDirectory 把 users 表适配为 Gallery application 的用户目录端口。
// （实现 application/gallery.UserDirectory，方法集即契约，无需具名引用。）
type GalleryUserDirectory struct {
	db *gorm.DB
}

func NewGalleryUserDirectory(db *gorm.DB) *GalleryUserDirectory {
	return &GalleryUserDirectory{db: db}
}

func (d *GalleryUserDirectory) FindIDByUsername(ctx context.Context, username string) (shared.ID, bool, error) {
	username = strings.TrimSpace(username)
	if username == "" {
		return shared.ID{}, false, nil
	}
	var row struct {
		ID uuid.UUID
	}
	err := d.db.WithContext(ctx).Model(&model.User{}).
		Select("id").
		Where("username = ?", username).
		Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return shared.ID{}, false, nil
	}
	if err != nil {
		return shared.ID{}, false, shared.Internal("查询图集作者失败", err)
	}
	return shared.IDFromUUID(row.ID), true, nil
}

func (d *GalleryUserDirectory) DisplayNamesByIDs(ctx context.Context, ids []shared.ID) (map[shared.ID]string, error) {
	names := make(map[shared.ID]string, len(ids))
	if len(ids) == 0 {
		return names, nil
	}
	uuids := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		uuids = append(uuids, id.UUID())
	}
	var rows []struct {
		ID          uuid.UUID
		Username    string
		DisplayName string
	}
	if err := d.db.WithContext(ctx).Model(&model.User{}).
		Select("id, username, display_name").
		Where("id IN ?", uuids).
		Scan(&rows).Error; err != nil {
		return nil, shared.Internal("查询图集作者失败", err)
	}
	for _, row := range rows {
		// display_name 可选;未设置时用 username 兜底,保证列表始终有可读作者名
		if row.DisplayName != "" {
			names[shared.IDFromUUID(row.ID)] = row.DisplayName
		} else {
			names[shared.IDFromUUID(row.ID)] = row.Username
		}
	}
	return names, nil
}
