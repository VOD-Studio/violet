package runtimelog

import (
	"context"
	"time"

	domainpermission "blog-api/internal/domain/permission"
	domainsession "blog-api/internal/domain/session"
)

type SessionReader interface {
	Get(context.Context, domainsession.ID) (*domainsession.Session, error)
}

type PermissionChecker interface {
	HasPermission(role string, isRoot bool, codes ...string) bool
}

type AccessValidator interface {
	CanRead(context.Context, string, string) bool
}

type SessionAccess struct {
	sessions    SessionReader
	permissions PermissionChecker
	idleTTL     time.Duration
}

func NewSessionAccess(sessions SessionReader, permissions PermissionChecker, idleTTL time.Duration) *SessionAccess {
	return &SessionAccess{sessions: sessions, permissions: permissions, idleTTL: idleTTL}
}

// CanRead 只读复核当前 opaque session 与实时权限，不续期、不轮换 session。
func (a *SessionAccess) CanRead(ctx context.Context, sessionID, expectedUserID string) bool {
	if sessionID == "" || expectedUserID == "" {
		return false
	}
	session, err := a.sessions.Get(ctx, domainsession.ID(sessionID))
	if err != nil || session.IsExpired(time.Now(), a.idleTTL) || session.UserID() != expectedUserID {
		return false
	}
	claims := session.Claims()
	return a.permissions.HasPermission(
		claims.Role,
		claims.IsRoot,
		domainpermission.AdminAccess.String(),
		domainpermission.RuntimeLogView.String(),
	)
}
