package bilibili

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDownload_EmptyURL(t *testing.T) {
	d := NewDownloader(t.TempDir(), "/uploads/")
	_, err := d.Download("")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "为空")
}

func TestDownload_Success_PNG(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write([]byte("fake-png-bytes"))
	}))
	defer srv.Close()

	dir := t.TempDir()
	d := NewDownloader(dir, "/uploads/")
	url, err := d.Download(srv.URL + "/e.png")
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(url, "/uploads/emojis/"))
	assert.True(t, strings.HasSuffix(url, ".png"))

	entries, _ := os.ReadDir(dir)
	require.Len(t, entries, 1)
	body, _ := os.ReadFile(filepath.Join(dir, entries[0].Name()))
	assert.Equal(t, "fake-png-bytes", string(body))
}

func TestDownload_InfersGifFromURL(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("gif"))
	}))
	defer srv.Close()

	d := NewDownloader(t.TempDir(), "/uploads/")
	url, err := d.Download(srv.URL + "/anim.gif")
	require.NoError(t, err)
	assert.True(t, strings.HasSuffix(url, ".gif"))
}

func TestDownload_Non200(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	d := NewDownloader(t.TempDir(), "/uploads/")
	_, err := d.Download(srv.URL + "/e.png")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "status=404")
}
