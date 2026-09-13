package settings

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"time"

	"github.com/rs/zerolog/log"

	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
)

// securityPendingTTL 待确认变更的确认窗口。超时未确认即失效，
// 数据库从未写入，自动维持上一有效配置。
const securityPendingTTL = 10 * time.Minute

// ErrSecurityConfirmationRequired 安全策略必须经限时确认流程修改。
var ErrSecurityConfirmationRequired = shared.BadRequest("安全策略变更需先保存待确认，再经短时运维授权确认生效")

// ErrNoSecurityPending 当前没有待确认的安全策略变更。
var ErrNoSecurityPending = shared.BadRequest("没有待确认的安全策略变更，请重新保存")

// ErrSecurityPendingReplaced 待确认槽位已被另一份变更替换。
var ErrSecurityPendingReplaced = shared.BadRequest("待确认变更已被新的保存替换，请核对当前变更后重新确认")

// securityPending 一份待确认的安全组变更。仅存进程内存：进程重启即丢弃，
// 数据库保持上一有效配置，方向安全。
type securityPending struct {
	// ID 槽位标识：确认时必须匹配，防止 A 看到的变更被 B 的保存替换后
	// 仍被 A 的二次验证确认（两份变更同版本时 CAS 无法识别替换）。
	ID string
	// ExpectedVersion 发起时的组版本；确认提交据此做 CAS
	ExpectedVersion int64
	// Values 已解码并整组校验通过的覆盖值（省略键不修改）
	Values map[string]string
	// RequestedBy 发起者用户 ID（审计与展示）
	RequestedBy string
	// RequestedAt 发起时间
	RequestedAt time.Time
	// ExpiresAt 确认截止时间
	ExpiresAt time.Time
}

// PendingSecurityChangeDTO 待确认变更的管理端视图。
type PendingSecurityChangeDTO struct {
	// ID 待确认变更标识；确认时回传，被替换的旧标识确认将被拒绝
	ID string `json:"id"`
	// ExpectedVersion 发起时的组版本
	ExpectedVersion int64 `json:"expected_version"`
	// Values 待生效的覆盖值
	Values map[string]string `json:"values"`
	// RequestedBy 发起者用户 ID
	RequestedBy string `json:"requested_by"`
	// RequestedAt 发起时间（RFC3339）
	RequestedAt string `json:"requested_at"`
	// ExpiresAt 确认截止时间（RFC3339）
	ExpiresAt string `json:"expires_at"`
}

// SetSecurityFloor 注入部署侧安全底线（装配期一次）。
func (s *Service) SetSecurityFloor(floor SecurityFloor) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.floor = floor
}

// SetSecurityApplier 注入安全组生效后的热应用回调（装配期一次）。
// 回调负责刷新受信代理解析器、CORS 来源与 Cookie 策略等运行时消费者。
//
// 约束：回调不得回读 Service（内部持锁调用），只消费传入的生效快照。
func (s *Service) SetSecurityApplier(fn func(domainsettings.SiteSettings)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.securityApplier = fn
}

// SetSecurityDeploymentOnly 切换部署恢复模式：忽略数据库安全覆盖。
func (s *Service) SetSecurityDeploymentOnly(enabled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.securityDeploymentOnly = enabled
}

// RequestSecurityChange 校验并暂存一份安全组变更，进入待确认状态。
// 数据库不写入：未确认（或超时）即维持上一有效配置。
func (s *Service) RequestSecurityChange(ctx context.Context, expected int64, patch map[string]json.RawMessage, requestedBy string) (PendingSecurityChangeDTO, error) {
	updates, err := decodePatch(domainsettings.Security, patch)
	if err != nil {
		return PendingSecurityChangeDTO{}, err
	}
	s.mu.Lock()
	floor := s.floor
	s.mu.Unlock()
	values := s.resolve(domainsettings.Security, withUpdates(s.overrideValues(domainsettings.Security), updates))
	if err := validateGroup(domainsettings.Security, values, floor); err != nil {
		return PendingSecurityChangeDTO{}, err
	}
	id := make([]byte, 8)
	if _, err := rand.Read(id); err != nil {
		return PendingSecurityChangeDTO{}, shared.Internal("生成变更标识失败", err)
	}
	now := time.Now()
	pending := securityPending{
		ID:              hex.EncodeToString(id),
		ExpectedVersion: expected,
		Values:          updates,
		RequestedBy:     requestedBy,
		RequestedAt:     now,
		ExpiresAt:       now.Add(securityPendingTTL),
	}
	s.mu.Lock()
	s.securityPendingChange = &pending
	s.mu.Unlock()
	return pendingDTO(pending), nil
}

// ConfirmSecurityChange 将待确认变更落库并热应用。
// pendingID 必须匹配当前槽位：槽位被后续保存替换时拒绝，防止确认到
// 操作者没有核对过的变更。调用方必须先完成短时运维授权校验。
func (s *Service) ConfirmSecurityChange(ctx context.Context, pendingID string) (GroupSnapshot, error) {
	s.mu.Lock()
	pending := s.securityPendingChange
	s.securityPendingChange = nil
	floor := s.floor
	s.mu.Unlock()
	if pending == nil || time.Now().After(pending.ExpiresAt) {
		s.publishSecurityCancelled(ctx, pending, "expired")
		return GroupSnapshot{}, ErrNoSecurityPending
	}
	if pending.ID != pendingID {
		// 槽位已被替换：恢复槽位并拒绝确认，待真正核对的发起者重新确认。
		s.mu.Lock()
		s.securityPendingChange = pending
		s.mu.Unlock()
		return GroupSnapshot{}, ErrSecurityPendingReplaced
	}
	snapshot, _, err := s.changeGroupTracked(ctx, domainsettings.Security, pending.ExpectedVersion, pending.Values, false, floor)
	if err != nil {
		// 版本冲突等失败：丢弃 pending，操作者重新发起。
		return GroupSnapshot{}, err
	}
	if s.bus != nil {
		keys := make([]string, 0, len(pending.Values))
		for key := range pending.Values {
			keys = append(keys, key)
		}
		if err := s.bus.Publish(ctx, []shared.DomainEvent{domainsettings.NewSecurityPolicyConfirmed(keys)}); err != nil {
			log.Warn().Err(err).Msg("发布安全策略确认事件失败")
		}
	}
	return snapshot, nil
}

// CancelSecurityChange 主动放弃待确认变更。
func (s *Service) CancelSecurityChange(ctx context.Context) error {
	s.mu.Lock()
	pending := s.securityPendingChange
	s.securityPendingChange = nil
	s.mu.Unlock()
	if pending == nil || time.Now().After(pending.ExpiresAt) {
		return ErrNoSecurityPending
	}
	s.publishSecurityCancelled(ctx, pending, "cancelled")
	return nil
}

// PendingSecurityChange 返回待确认变更视图；无或已过期返回零值与 false。
func (s *Service) PendingSecurityChange() (PendingSecurityChangeDTO, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	pending := s.securityPendingChange
	if pending == nil || time.Now().After(pending.ExpiresAt) {
		return PendingSecurityChangeDTO{}, false
	}
	return pendingDTO(*pending), true
}

func (s *Service) publishSecurityCancelled(ctx context.Context, pending *securityPending, reason string) {
	if pending == nil || s.bus == nil {
		return
	}
	keys := make([]string, 0, len(pending.Values))
	for key := range pending.Values {
		keys = append(keys, key)
	}
	if err := s.bus.Publish(ctx, []shared.DomainEvent{domainsettings.NewSecurityPolicyCancelled(keys, reason)}); err != nil {
		log.Warn().Err(err).Msg("发布安全策略取消事件失败")
	}
}

func pendingDTO(pending securityPending) PendingSecurityChangeDTO {
	return PendingSecurityChangeDTO{
		ID:              pending.ID,
		ExpectedVersion: pending.ExpectedVersion,
		Values:          pending.Values,
		RequestedBy:     pending.RequestedBy,
		RequestedAt:     pending.RequestedAt.UTC().Format(time.RFC3339),
		ExpiresAt:       pending.ExpiresAt.UTC().Format(time.RFC3339),
	}
}

// overrideValues 返回当前数据库显式覆盖（不含部署默认），供整组校验合并。
func (s *Service) overrideValues(group domainsettings.Group) map[string]string {
	record, err := s.store.ReadGroup(context.Background(), group)
	if err != nil {
		return map[string]string{}
	}
	return record.Values
}

// withUpdates 在原覆盖之上叠加待确认变更（省略键保留）。
func withUpdates(previous, updates map[string]string) map[string]string {
	merged := make(map[string]string, len(previous)+len(updates))
	for key, value := range previous {
		merged[key] = value
	}
	for key, value := range updates {
		merged[key] = value
	}
	return merged
}
