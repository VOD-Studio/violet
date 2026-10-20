package music_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	appmusic "blog-api/internal/application/music"
	"blog-api/internal/infrastructure/kite"
	musichttp "blog-api/internal/interfaces/http/handler/music"
)

func TestKiteAuthenticationFailureNeverLogsOutBlogSession(t *testing.T) {
	for _, test := range []struct {
		reason string
		status int
	}{
		{"SERVER_AUTH_FAILED", http.StatusInternalServerError},
		{"LOGIN_REQUIRED", http.StatusBadRequest},
	} {
		t.Run(test.reason, func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(401)
				_, _ = w.Write([]byte(`{"message":"private-upstream-body","details":[{"reason":"` + test.reason + `"}]}`))
			}))
			defer upstream.Close()
			handler := musichttp.NewHandler(appmusic.NewService(nil, kite.NewClient(upstream.URL, "private-token"), nil))
			request := httptest.NewRequest(http.MethodGet, "/music/songs/42", nil)
			request.SetPathValue("id", "42")
			request.Header.Set("Cookie", "violet_session=existing-session")
			response := httptest.NewRecorder()
			handler.Song(response, request)
			assert.Equal(t, test.status, response.Code)
			assert.Empty(t, response.Header().Values("Set-Cookie"))
			assert.NotContains(t, response.Body.String(), "private")
		})
	}
}
func TestInvalidMusicIDNeverReachesKite(t *testing.T) {
	handler := musichttp.NewHandler(appmusic.NewService(nil, nil, nil))
	for _, id := range []string{"0", "-1", "01", "1/2", "9223372036854775808"} {
		request := httptest.NewRequest(http.MethodGet, "/music/songs/invalid", nil)
		request.SetPathValue("id", id)
		response := httptest.NewRecorder()
		handler.Song(response, request)
		assert.Equal(t, http.StatusBadRequest, response.Code)
	}
}

func TestKiteFailuresReturnServerErrors(t *testing.T) {
	for _, test := range []struct {
		name   string
		status int
		body   string
	}{
		{"unavailable", http.StatusServiceUnavailable, `{"message":"private-upstream-body"}`},
		{"malformed_response", http.StatusOK, `{"invalid`},
	} {
		t.Run(test.name, func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(test.status)
				_, _ = w.Write([]byte(test.body))
			}))
			defer upstream.Close()
			handler := musichttp.NewHandler(appmusic.NewService(nil, kite.NewClient(upstream.URL, "private-token"), nil))
			request := httptest.NewRequest(http.MethodGet, "/music/songs/42", nil)
			request.SetPathValue("id", "42")
			response := httptest.NewRecorder()
			handler.Song(response, request)
			assert.Equal(t, http.StatusInternalServerError, response.Code)
			assert.Contains(t, response.Body.String(), `"error":"INTERNAL_ERROR"`)
			assert.NotContains(t, response.Body.String(), "private")
		})
	}
}
