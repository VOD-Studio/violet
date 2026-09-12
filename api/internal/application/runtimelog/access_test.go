package runtimelog

import (
	"context"
	"testing"
	"time"

	domainpermission "blog-api/internal/domain/permission"
	domainsession "blog-api/internal/domain/session"
	"github.com/stretchr/testify/require"
)

type sessionReaderStub struct {
	session *domainsession.Session
}

func (s sessionReaderStub) Get(context.Context, domainsession.ID) (*domainsession.Session, error) {
	return s.session, nil
}

type permissionCheckerStub struct {
	granted map[string]bool
}

func (s permissionCheckerStub) HasPermission(_ string, _ bool, codes ...string) bool {
	for _, code := range codes {
		if !s.granted[code] {
			return false
		}
	}
	return true
}

func TestSessionAccessRequiresAdminEntryAndRuntimeLogPermission(t *testing.T) {
	now := time.Now()
	session := domainsession.Reconstruct(
		domainsession.ID("opaque-session"),
		"user-1",
		"operator@example.test",
		"operator",
		false,
		domainsession.CSRFToken("csrf"),
		now,
		now,
		time.Time{},
	)
	reader := sessionReaderStub{session: session}
	viewOnly := NewSessionAccess(reader, permissionCheckerStub{granted: map[string]bool{
		domainpermission.RuntimeLogView.String(): true,
	}}, time.Hour)
	require.False(t, viewOnly.CanRead(context.Background(), "opaque-session", "user-1"))

	fullyAuthorized := NewSessionAccess(reader, permissionCheckerStub{granted: map[string]bool{
		domainpermission.AdminAccess.String():    true,
		domainpermission.RuntimeLogView.String(): true,
	}}, time.Hour)
	require.True(t, fullyAuthorized.CanRead(context.Background(), "opaque-session", "user-1"))
}
