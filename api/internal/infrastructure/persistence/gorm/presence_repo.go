package gorm

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	domainpresence "blog-api/internal/domain/presence"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/infrastructure/persistence/gorm/model"
)

// PresenceRepository GORM 实现的实时状态设备与设置仓储。
type PresenceRepository struct {
	db *gorm.DB
}

func NewPresenceRepository(db *gorm.DB) *PresenceRepository {
	return &PresenceRepository{db: db}
}

func (r *PresenceRepository) ListDevices(ctx context.Context) ([]*domainpresence.Device, error) {
	var rows []model.PresenceDevice
	if err := r.db.WithContext(ctx).Order("created_at ASC, id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	devices := make([]*domainpresence.Device, 0, len(rows))
	for _, row := range rows {
		device, err := presenceDeviceToDomain(row)
		if err != nil {
			return nil, err
		}
		devices = append(devices, device)
	}
	return devices, nil
}

func (r *PresenceRepository) CreateDevice(ctx context.Context, device *domainpresence.Device) error {
	return r.db.WithContext(ctx).Create(&model.PresenceDevice{
		ID:          device.ID().String(),
		DisplayName: device.DisplayName(),
		TokenHash:   device.TokenHash(),
		CreatedAt:   device.CreatedAt(),
	}).Error
}

// DeleteDevice 删除并返回被删设备，供撤销事件记录名称快照。
func (r *PresenceRepository) DeleteDevice(ctx context.Context, id domainshared.ID) (*domainpresence.Device, error) {
	var row model.PresenceDevice
	err := r.db.WithContext(ctx).
		Clauses(clause.Returning{}).
		Where("id = ?", id.String()).
		Delete(&row).Error
	if err != nil {
		return nil, err
	}
	if row.ID == "" {
		return nil, domainpresence.ErrDeviceNotFound
	}
	return presenceDeviceToDomain(row)
}

func (r *PresenceRepository) FindDeviceByTokenHash(ctx context.Context, tokenHash string) (*domainpresence.Device, error) {
	var row model.PresenceDevice
	err := r.db.WithContext(ctx).Where("token_hash = ?", tokenHash).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domainpresence.ErrDeviceNotFound
	}
	if err != nil {
		return nil, err
	}
	return presenceDeviceToDomain(row)
}

func (r *PresenceRepository) Settings(ctx context.Context) (domainpresence.Settings, error) {
	var row model.PresenceSettings
	if err := r.db.WithContext(ctx).Where("id = 1").First(&row).Error; err != nil {
		return domainpresence.Settings{}, err
	}
	return domainpresence.Settings{PublicRead: row.PublicRead}, nil
}

func (r *PresenceRepository) SaveSettings(ctx context.Context, settings domainpresence.Settings) error {
	return r.db.WithContext(ctx).Model(&model.PresenceSettings{}).
		Where("id = 1").
		Update("public_read", settings.PublicRead).Error
}

func presenceDeviceToDomain(row model.PresenceDevice) (*domainpresence.Device, error) {
	id, err := domainshared.ParseID(row.ID)
	if err != nil {
		return nil, err
	}
	return domainpresence.ReconstructDevice(id, row.DisplayName, row.TokenHash, row.CreatedAt), nil
}
