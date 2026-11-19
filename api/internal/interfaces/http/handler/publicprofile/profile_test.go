package publicprofile

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appprofile "blog-api/internal/application/publicprofile"
	"blog-api/internal/domain/shared"
	"blog-api/internal/domain/user"
)

type publicUsers struct {
	user.UserRepository
	u *user.User
}

func (r publicUsers) FindByUsername(_ context.Context, name user.Username) (*user.User, error) {
	if name.String() != "alice" {
		return nil, user.ErrNotFound
	}
	return r.u, nil
}

type emptyPublicReader struct{}

func (emptyPublicReader) Summary(context.Context, shared.ID, time.Time, time.Time) (appprofile.Stats, []appprofile.Day, error) {
	return appprofile.Stats{}, nil, nil
}
func (emptyPublicReader) Activities(context.Context, shared.ID, string, appprofile.Position, int) ([]appprofile.Activity, error) {
	return []appprofile.Activity{}, nil
}

func TestPublicProfileHTTP_AnonymousProjectionAndMissingAccount(t *testing.T) {
	email, err := user.ParseEmail("private@example.com")
	require.NoError(t, err)
	name, err := user.ParseUsername("alice")
	require.NoError(t, err)
	u := user.NewUser(shared.NewID(), email, name, user.NewPasswordHash(""))
	u.UpdateCoverURL("https://example.com/cover.gif?crop=1,2,3,4")
	h := NewHandler(appprofile.NewService(publicUsers{u: u}, emptyPublicReader{}))
	r := httptest.NewRequest(http.MethodGet, "/users/alice", nil)
	r.SetPathValue("username", "alice")
	w := httptest.NewRecorder()
	h.Get(w, r)
	require.Equal(t, http.StatusOK, w.Code)
	var body struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	assert.Equal(t, u.CoverURL(), body.Data["cover_url"])
	for _, key := range []string{"email", "role", "permissions", "omp_usage", "reading_history"} {
		assert.NotContains(t, body.Data, key)
	}
	assert.NotNil(t, body.Data["public_reading_preferences"])
	for _, handler := range []func(http.ResponseWriter, *http.Request){h.Get, h.List} {
		r := httptest.NewRequest(http.MethodGet, "/users/missing", nil)
		r.SetPathValue("username", "missing")
		w := httptest.NewRecorder()
		handler(w, r)
		assert.Equal(t, http.StatusNotFound, w.Code)
	}
}
