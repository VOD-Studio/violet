package presence

import (
	"context"
	"errors"

	domainshared "blog-api/internal/domain/shared"
)

// ErrDeviceNotFound 设备不存在或已撤销。
var ErrDeviceNotFound = errors.New("presence device not found")

// Settings 接收端公开策略。
type Settings struct {
	// PublicRead 是否允许匿名访客读取当前状态；默认关闭，与设备是否上报无关
	PublicRead bool
}

// Repository 设备凭证与公开策略的持久化端口；活动快照只在内存，不经此端口。
type Repository interface {
	// ListDevices 按签发时间升序列出全部设备
	ListDevices(ctx context.Context) ([]*Device, error)
	// CreateDevice 持久化新签发的设备
	CreateDevice(ctx context.Context, device *Device) error
	// DeleteDevice 撤销设备；不存在返回 ErrDeviceNotFound
	DeleteDevice(ctx context.Context, id domainshared.ID) (*Device, error)
	// FindDeviceByTokenHash 按凭证哈希查找设备；不存在返回 ErrDeviceNotFound
	FindDeviceByTokenHash(ctx context.Context, tokenHash string) (*Device, error)
	// Settings 读取公开策略
	Settings(ctx context.Context) (Settings, error)
	// SaveSettings 覆盖公开策略
	SaveSettings(ctx context.Context, settings Settings) error
}
