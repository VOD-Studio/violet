package comment

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestListByPostRejectsInvalidSortBeforeLookup(t *testing.T) {
	h := &Handler{}
	for _, sort := range []string{"desc", "HOT", "unknown"} {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodGet, "/posts/example/comments?sort="+sort, nil)
		h.ListByPost(w, r)
		require.Equal(t, http.StatusBadRequest, w.Code)
	}
}
