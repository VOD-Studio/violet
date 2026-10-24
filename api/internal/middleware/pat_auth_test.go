package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/require"

	domainapitoken "blog-api/internal/domain/api_token"
	inframcp "blog-api/internal/infrastructure/mcp"
)

type patLookup struct {
	pat     *domainapitoken.PAT
	err     error
	touched chan string
}

func (l *patLookup) FindByHash(_ context.Context, hash string) (*domainapitoken.PAT, error) {
	if l.err != nil {
		return nil, l.err
	}
	if l.pat == nil || l.pat.TokenHash() != hash {
		return nil, domainapitoken.ErrNotFound
	}
	return l.pat, nil
}

func (l *patLookup) TouchLastUsed(ctx context.Context, id string, _ time.Time) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	l.touched <- id
	return nil
}

func TestPATAuth_ArbitrarySubtreeAndExactScopes(t *testing.T) {
	for _, tc := range []struct {
		name      string
		header    string
		scope     string
		expires   time.Time
		lookupErr error
		status    int
	}{
		{name: "authorized", header: "Bearer secret", scope: "usage:write", status: 204},
		{name: "case insensitive scheme", header: "bearer secret", scope: "usage:write", status: 204},
		{name: "missing", scope: "usage:write", status: 401},
		{name: "forged", header: "Bearer forged", scope: "usage:write", status: 401},
		{name: "expired", header: "Bearer secret", scope: "usage:write", expires: time.Now().Add(-time.Hour), status: 401},
		{name: "wrong scope", header: "Bearer secret", scope: "posts:write", status: 403},
		{name: "wildcard is not exact", header: "Bearer secret", scope: "usage:*", status: 403},
		{name: "lookup failure", header: "Bearer secret", scope: "usage:write", lookupErr: errors.New("database unavailable"), status: 500},
	} {
		t.Run(tc.name, func(t *testing.T) {
			lookup := &patLookup{
				pat: domainapitoken.Reconstruct("token-id", "owner", "client", domainapitoken.HashToken("secret"), []string{tc.scope}, tc.expires, time.Time{}, time.Now(), true),
				err: tc.lookupErr, touched: make(chan string, 1),
			}
			router := chi.NewRouter()
			router.Route("/arbitrary", func(r chi.Router) {
				r.Use(PATAuth(inframcp.NewPATVerifier(lookup)), RequireScope("usage:write"))
				r.Post("/action", func(w http.ResponseWriter, r *http.Request) {
					require.Equal(t, "owner", GetUserID(r.Context()))
					require.Equal(t, []string{"usage:write"}, GetPATScopes(r.Context()))
					require.False(t, GetUserIsRoot(r.Context()))
					require.Empty(t, GetUserRole(r.Context()))
					w.WriteHeader(http.StatusNoContent)
				})
			})
			req := httptest.NewRequest(http.MethodPost, "/arbitrary/action", nil)
			req.Header.Set("Authorization", tc.header)
			ctx := context.WithValue(req.Context(), UserIDKey, "cookie-owner")
			ctx = context.WithValue(ctx, UserIsRootKey, true)
			ctx = context.WithValue(ctx, UserRoleKey, "superadmin")
			req = req.WithContext(ctx)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			require.Equal(t, tc.status, w.Code, w.Body.String())
			if tc.status != 204 {
				require.Contains(t, w.Header().Get("Content-Type"), "application/json")
				var envelope struct {
					Error   string `json:"error"`
					Message string `json:"message"`
				}
				require.NoError(t, json.Unmarshal(w.Body.Bytes(), &envelope))
				require.NotEmpty(t, envelope.Error)
				require.NotEmpty(t, envelope.Message)
			}
			if tc.status == 204 || tc.status == 403 {
				select {
				case id := <-lookup.touched:
					require.Equal(t, "token-id", id)
				case <-time.After(time.Second):
					t.Fatal("PAT last_used_at was not refreshed")
				}
			}
		})
	}
}
