package presence

import domainshared "blog-api/internal/domain/shared"

// DeviceAuthorized 设备凭证已签发事件；凭证生命周期需要审计。
type DeviceAuthorized struct {
	domainshared.BaseEvent
	// DisplayName 设备名称快照
	DisplayName string
}

// NewDeviceAuthorized 构造设备签发事件。
func NewDeviceAuthorized(device *Device) DeviceAuthorized {
	return DeviceAuthorized{
		BaseEvent:   domainshared.NewBaseEvent("presence.device_authorized", device.ID()),
		DisplayName: device.DisplayName(),
	}
}

// DeviceRevoked 设备凭证已撤销事件。
type DeviceRevoked struct {
	domainshared.BaseEvent
	// DisplayName 设备名称快照（撤销前）
	DisplayName string
}

// NewDeviceRevoked 构造设备撤销事件。
func NewDeviceRevoked(device *Device) DeviceRevoked {
	return DeviceRevoked{
		BaseEvent:   domainshared.NewBaseEvent("presence.device_revoked", device.ID()),
		DisplayName: device.DisplayName(),
	}
}

// PublicReadChanged 公开读取开关已变更事件；决定访客能否看到当前状态，需要审计。
type PublicReadChanged struct {
	domainshared.BaseEvent
	// Enabled 变更后的开关值
	Enabled bool
}

// NewPublicReadChanged 构造公开读取变更事件；接收端单例，聚合 ID 用操作者 ID。
func NewPublicReadChanged(actorID domainshared.ID, enabled bool) PublicReadChanged {
	return PublicReadChanged{
		BaseEvent: domainshared.NewBaseEvent("presence.public_read_changed", actorID),
		Enabled:   enabled,
	}
}
