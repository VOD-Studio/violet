package github

import (
	"io"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	activity "blog-api/internal/domain/repositoryactivity"
)

func TestActivityAdapterReadsOnlyPublicMetadata(t *testing.T) {
	const sha = "0123456789abcdef0123456789abcdef01234567"
	adapter := NewActivityAdapter()
	var requests []string
	adapter.client.Transport = activityTestTransport(func(req *http.Request) *http.Response {
		assert.Equal(t, http.MethodGet, req.Method)
		assert.Equal(t, "api.github.com", req.URL.Host)
		assert.Equal(t, "https", req.URL.Scheme)
		assert.Empty(t, req.Header.Get("Authorization"))
		assert.Nil(t, req.URL.User)
		requests = append(requests, req.URL.Path)
		switch req.URL.Path {
		case "/repos/owner/repo":
			return activityResponse(http.StatusOK, `{"id":123,"full_name":"Owner/Repo","private":false,"visibility":"public","default_branch":"release/2.0"}`)
		case "/repos/Owner/Repo/commits":
			assert.Equal(t, "2", req.URL.Query().Get("page"))
			assert.Equal(t, "100", req.URL.Query().Get("per_page"))
			assert.Equal(t, "release/2.0", req.URL.Query().Get("sha"))
			resp := activityResponse(http.StatusOK, `[{"sha":"`+sha+`","html_url":"https://wrong.invalid","commit":{"author":{"date":"2026-11-15T15:50:00Z","email":"not-public@example.com"},"committer":{"date":"2026-11-15T16:01:00Z"},"message":"Title\r\nprivate-looking body"}}]`)
			resp.Header.Set("Link", `<https://wrong.invalid/?page=3>; rel="next", <https://wrong.invalid/?page=8>; rel="last"`)
			return resp
		case "/repos/Owner/Repo/releases":
			assert.Equal(t, "1", req.URL.Query().Get("page"))
			return activityResponse(http.StatusOK, `[
				{"id":52,"tag_name":"unpublished","name":"Hidden draft","draft":true,"published_at":null},
				{"id":51,"tag_name":"v2.0.0","name":"","body":"not exposed","draft":false,"created_at":"2026-11-15T15:00:00Z","published_at":"2026-11-15T16:15:00Z"}
			]`)
		default:
			t.Errorf("unexpected GitHub request: %s", req.URL)
			return activityResponse(http.StatusInternalServerError, "")
		}
	})

	remote, err := adapter.Inspect(t.Context(), "owner/repo")
	require.NoError(t, err)
	assert.Equal(t, activity.Remote{ID: 123, Key: "Owner/Repo", DefaultBranch: "release/2.0"}, remote)
	commits, err := adapter.Commits(t.Context(), remote, remote.DefaultBranch, 2)
	require.NoError(t, err)
	assert.True(t, commits.HasNext)
	require.Len(t, commits.Events, 1)
	assert.Equal(t, "Title", commits.Events[0].Title)
	assert.Equal(t, "2026-11-15T16:01:00Z", commits.Events[0].OccurredAt.Format(time.RFC3339))
	assert.Equal(t, "https://github.com/Owner/Repo/commit/"+sha, commits.Events[0].URL)
	releases, err := adapter.Releases(t.Context(), remote, 1)
	require.NoError(t, err)
	require.Len(t, releases.Events, 1)
	assert.Equal(t, "51", releases.Events[0].ID)
	assert.Equal(t, "v2.0.0", releases.Events[0].Title)
	assert.Equal(t, "2026-11-15T16:15:00Z", releases.Events[0].OccurredAt.Format(time.RFC3339))
	assert.Equal(t, "https://github.com/Owner/Repo/releases/tag/v2.0.0", releases.Events[0].URL)
	assert.Equal(t, []string{"/repos/owner/repo", "/repos/Owner/Repo/commits", "/repos/Owner/Repo/releases"}, requests)
}

func TestActivityAdapterDistinguishesVisibilityAndThrottling(t *testing.T) {
	t.Run("a redirect never sends a second request", func(t *testing.T) {
		adapter := NewActivityAdapter()
		calls := 0
		adapter.client.Transport = activityTestTransport(func(req *http.Request) *http.Response {
			calls++
			assert.Equal(t, "api.github.com", req.URL.Host)
			resp := activityResponse(http.StatusMovedPermanently, "")
			resp.Header.Set("Location", "https://other.invalid/repos/owner/private")
			return resp
		})
		_, err := adapter.Inspect(t.Context(), "owner/repo")
		require.ErrorIs(t, err, activity.ErrUnavailable)
		assert.Equal(t, 1, calls)
	})

	for name, body := range map[string]string{
		"private":                `{"id":1,"full_name":"owner/repo","private":true,"visibility":"private","default_branch":"main"}`,
		"visibility unspecified": `{"id":1,"full_name":"owner/repo","private":false,"default_branch":"main"}`,
		"different identity":     `{"id":1,"full_name":"owner/other","private":false,"visibility":"public","default_branch":"main"}`,
	} {
		t.Run(name, func(t *testing.T) {
			adapter := NewActivityAdapter()
			adapter.client.Transport = activityTestTransport(func(*http.Request) *http.Response {
				return activityResponse(http.StatusOK, body)
			})
			_, err := adapter.Inspect(t.Context(), "owner/repo")
			require.ErrorIs(t, err, activity.ErrUnavailable)
		})
	}

	t.Run("anonymous primary quota preserves its reset", func(t *testing.T) {
		adapter := NewActivityAdapter()
		reset := time.Now().Add(11 * time.Minute).Truncate(time.Second)
		adapter.client.Transport = activityTestTransport(func(*http.Request) *http.Response {
			resp := activityResponse(http.StatusForbidden, `{"message":"API rate limit exceeded"}`)
			resp.Header.Set("X-RateLimit-Remaining", "0")
			resp.Header.Set("X-RateLimit-Reset", strconv.FormatInt(reset.Unix(), 10))
			return resp
		})
		_, err := adapter.Inspect(t.Context(), "owner/repo")
		var rate *activity.RateLimitError
		require.ErrorAs(t, err, &rate)
		assert.True(t, rate.RetryAt.Equal(reset))
	})

	t.Run("private status does not look like rate limiting", func(t *testing.T) {
		adapter := NewActivityAdapter()
		adapter.client.Transport = activityTestTransport(func(*http.Request) *http.Response {
			return activityResponse(http.StatusNotFound, `{"message":"Not Found"}`)
		})
		_, err := adapter.Inspect(t.Context(), "owner/repo")
		require.ErrorIs(t, err, activity.ErrUnavailable)
	})
}

type activityTestTransport func(*http.Request) *http.Response

func (transport activityTestTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	resp := transport(req)
	resp.Request = req
	return resp, nil
}

func activityResponse(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}
}
