package tweet

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestListCommentsRejectsInvalidSort(t *testing.T) {
	h := newCommentTestHandler(&stubTweetRepo{}, newStubCommentRepo())
	for _, sort := range []string{"asc", "HOT", "unknown"} {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/tweets/example/comments?sort="+sort, nil)
		r.SetPathValue("id", "example")
		h.ListComments(w, r)
		require.Equal(t, http.StatusBadRequest, w.Code)
		require.Contains(t, w.Body.String(), "latest")
	}
}
