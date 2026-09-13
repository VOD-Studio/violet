package command

import (
	"blog-api/internal/domain/opsgrant"
	"blog-api/internal/domain/shared"
)

// OpsGrantIssued 短时运维授权签发成功事件。
//
// 订阅者：审计服务。不记录验证码或密码；Method 区分验证通道。
type OpsGrantIssued struct {
	shared.BaseEvent
	// Category 授权类别
	Category opsgrant.Category
	// Method 验证方式：password | email_code
	Method string
}

// NewOpsGrantIssued 构造授权签发事件。
func NewOpsGrantIssued(userID shared.ID, category opsgrant.Category, method string) OpsGrantIssued {
	return OpsGrantIssued{
		BaseEvent: shared.NewBaseEvent("ops.grant_issued", userID),
		Category:  category,
		Method:    method,
	}
}

// OpsGrantDenied 短时运维授权验证失败事件（暴力尝试的审计线索）。
//
// Reason 为粗粒度失败类别，不含任何凭证细节。
type OpsGrantDenied struct {
	shared.BaseEvent
	// Category 申请的授权类别
	Category opsgrant.Category
	// Reason 失败类别：invalid_request | no_password | bad_password | no_email | bad_code | unknown_method | invalid_grant
	Reason string
}

// NewOpsGrantDenied 构造授权拒绝事件。
func NewOpsGrantDenied(userID shared.ID, category opsgrant.Category, reason string) OpsGrantDenied {
	return OpsGrantDenied{
		BaseEvent: shared.NewBaseEvent("ops.grant_denied", userID),
		Category:  category,
		Reason:    reason,
	}
}

// SessionRevoked 指定 session 被吊销事件（设备管理/管理员处置）。
type SessionRevoked struct {
	shared.BaseEvent
	// PublicID 被吊销会话的公开标识（SHA-256 派生，非凭据）
	PublicID string
	// Self 是否本人操作（false = 管理员吊销他人会话）
	Self bool
}

// OpsGrantRevoked 运维授权被主动吊销事件（完成后收权）。
type OpsGrantRevoked struct {
	shared.BaseEvent
}

// NewOpsGrantRevoked 构造授权吊销事件。
func NewOpsGrantRevoked(userID shared.ID) OpsGrantRevoked {
	return OpsGrantRevoked{
		BaseEvent: shared.NewBaseEvent("ops.grant_revoked", userID),
	}
}

// NewSessionRevoked 构造会话吊销事件。
func NewSessionRevoked(userID shared.ID, publicID string, self bool) SessionRevoked {
	return SessionRevoked{
		BaseEvent: shared.NewBaseEvent("session.revoked", userID),
		PublicID:  publicID,
		Self:      self,
	}
}

// SessionEvicted 并发上限淘汰最旧会话事件（登录时触发）。
type SessionEvicted struct {
	shared.BaseEvent
	// Count 本次被淘汰的会话数
	Count int
}

// NewSessionEvicted 构造会话淘汰事件。
func NewSessionEvicted(userID shared.ID, count int) SessionEvicted {
	return SessionEvicted{
		BaseEvent: shared.NewBaseEvent("session.evicted", userID),
		Count:     count,
	}
}
