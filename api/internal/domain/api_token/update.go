package apitoken

import (
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	domainshared "blog-api/internal/domain/shared"
)

// UpdateInput 的 nil 字段保持原值；ExpiresAt 指向零时间表示永不过期。
type UpdateInput struct {
	// Name 新名称，nil 保留原值
	Name *string
	// Scopes 新权限集合，nil 保留原值，指向空集合不合法
	Scopes *[]string
	// ExpiresAt 新过期时间，nil 保留原值，零时间为永久
	ExpiresAt *time.Time
	// Interactive 新交互偏好，nil 保留原值
	Interactive *bool
}

// PATChange 仅承载可编辑的安全字段差异，不含凭据。
type PATChange struct {
	// Field 字段名：name/scopes/expires_at/interactive
	Field string
	// From 修改前的安全值
	From any
	// To 修改后的安全值
	To any
}

// PATUpdated 的聚合 ID 为令牌 ID，而非持有人 ID。
type PATUpdated struct {
	domainshared.BaseEvent
	// Name 更新后的名称快照
	Name string
	// Changes 实际发生变化的安全字段
	Changes []PATChange
}

// NewPATUpdated 以令牌 ID 定位审计资源，只携带实际安全字段差异。
func NewPATUpdated(id domainshared.ID, name string, changes []PATChange) PATUpdated {
	return PATUpdated{
		BaseEvent: domainshared.NewBaseEvent("api_token.updated", id),
		Name:      name,
		Changes:   changes,
	}
}

// Update 原子校验全部编辑字段，旧令牌即使已经过期也允许保留到期时间改名。
func (p *PAT) Update(in UpdateInput, now time.Time) ([]PATChange, error) {
	name := p.name
	if in.Name != nil {
		var err error
		name, err = validateName(*in.Name)
		if err != nil {
			return nil, err
		}
	}
	if in.Scopes != nil {
		if err := validateScopes(*in.Scopes); err != nil {
			return nil, err
		}
	}
	if in.ExpiresAt != nil && !in.ExpiresAt.IsZero() && !in.ExpiresAt.After(now) {
		return nil, domainshared.BadRequest("过期日期不能早于今天")
	}

	var changes []PATChange
	if name != p.name {
		changes = append(changes, PATChange{Field: "name", From: p.name, To: name})
		p.name = name
	}
	if in.Scopes != nil && !slices.Equal(p.scopes, *in.Scopes) {
		scopes := slices.Clone(*in.Scopes)
		changes = append(changes, PATChange{Field: "scopes", From: p.scopes, To: scopes})
		p.scopes = scopes
	}
	if in.ExpiresAt != nil && !p.expiresAt.Equal(*in.ExpiresAt) {
		changes = append(changes, PATChange{Field: "expires_at", From: expiryValue(p.expiresAt), To: expiryValue(*in.ExpiresAt)})
		p.expiresAt = *in.ExpiresAt
	}
	if in.Interactive != nil && p.interactive != *in.Interactive {
		changes = append(changes, PATChange{Field: "interactive", From: p.interactive, To: *in.Interactive})
		p.interactive = *in.Interactive
	}
	return changes, nil
}

func validateName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", domainshared.BadRequest("令牌名称不能为空")
	}
	if utf8.RuneCountInString(name) > 100 {
		return "", domainshared.BadRequest("令牌名称不能超过100字")
	}
	return name, nil
}

func validateScopes(scopes []string) error {
	if len(scopes) == 0 {
		return domainshared.BadRequest("至少选择一个权限范围")
	}
	for _, scope := range scopes {
		if !IsValidScope(scope) {
			return domainshared.BadRequest("未知的权限范围: " + scope)
		}
	}
	return nil
}

func expiryValue(t time.Time) any {
	if t.IsZero() {
		return nil
	}
	return t.Format(time.RFC3339Nano)
}
