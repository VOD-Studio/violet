package linkpreview

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-playground/validator/v10"

	applp "blog-api/internal/application/linkpreview"
)

type stubLookup struct {
	calls int
	last  []string
}

func (s *stubLookup) Lookup(_ context.Context, urls []string) (applp.LookupResultDTO, error) {
	s.calls++
	s.last = urls
	return applp.LookupResultDTO{
		Cards:   map[string]*applp.LinkCardDTO{"https://example.com/a": {URL: "https://example.com/a", Title: "标题"}},
		Pending: []string{}, Unavailable: []string{},
	}, nil
}

func newLookupServer(t *testing.T) (*stubLookup, *httptest.Server) {
	t.Helper()
	stub := &stubLookup{}
	h := &Handler{svc: stub, validate: validator.New()}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /lookup", h.Lookup)
	return stub, httptest.NewServer(mux)
}

func TestLookup_ReturnsDisplayableCards(t *testing.T) {
	stub, srv := newLookupServer(t)
	defer srv.Close()

	res, err := http.Post(srv.URL+"/lookup", "application/json",
		strings.NewReader(`{"urls":["https://example.com/a","bad"]}`))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", res.StatusCode)
	}
	var body struct {
		Data struct {
			Cards map[string]applp.LinkCardDTO `json:"cards"`
		} `json:"data"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if len(body.Data.Cards) != 1 || body.Data.Cards["https://example.com/a"].Title != "标题" {
		t.Errorf("cards = %+v", body.Data.Cards)
	}
	if stub.calls != 1 {
		t.Errorf("service calls = %d", stub.calls)
	}
}

func TestLookup_RejectsTooManyURLs(t *testing.T) {
	_, srv := newLookupServer(t)
	defer srv.Close()

	urls := make([]string, 11)
	for i := range urls {
		urls[i] = "https://example.com/" + string(rune('a'+i))
	}
	payload, _ := json.Marshal(map[string][]string{"urls": urls})
	res, err := http.Post(srv.URL+"/lookup", "application/json", strings.NewReader(string(payload)))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("11 个 URL 应 400, got %d", res.StatusCode)
	}
}

func TestLookup_RejectsEmptyBody(t *testing.T) {
	_, srv := newLookupServer(t)
	defer srv.Close()

	res, err := http.Post(srv.URL+"/lookup", "application/json", strings.NewReader("not json"))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusBadRequest {
		t.Fatalf("非法 JSON 应 400, got %d", res.StatusCode)
	}
}
