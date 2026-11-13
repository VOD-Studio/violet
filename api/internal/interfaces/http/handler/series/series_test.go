package series

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	appseries "blog-api/internal/application/series"
)

func TestListPublished_InvalidSource_Returns400(t *testing.T) {
	h := NewHandler(appseries.NewService(nil, nil))
	for _, source := range []string{"invalid", "Original", "%20"} {
		t.Run(source, func(t *testing.T) {
			w := httptest.NewRecorder()
			h.ListPublished(w, httptest.NewRequest(http.MethodGet, "/series?source="+source, nil))
			assert.Equal(t, http.StatusBadRequest, w.Code)
			assert.Contains(t, w.Body.String(), `"error":"BAD_REQUEST"`)
		})
	}
}
