package image

import (
	"bytes"
	stdimage "image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appimage "blog-api/internal/application/image"
	infraimage "blog-api/internal/infrastructure/image"
)

// TestServeImage_PathTraversal_Returns400 路径含 ".." → 拒绝 400。
// 用嵌入串（非真实穿越段）避免 net/http 路径归一化影响 substring 判定。
func TestServeImage_PathTraversal_Returns400(t *testing.T) {
	h := NewHandler(nil, "/tmp/uploads", "/uploads")

	req := httptest.NewRequest(http.MethodGet, "/uploads/foo..bar", nil)
	rec := httptest.NewRecorder()
	h.ServeImage(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "非法路径")
}

func TestExternalImagesAreUncachedAndUnavailableAfterWithdrawal(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "external-tweets", "source", "version", "photo.png")
	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))
	var data bytes.Buffer
	require.NoError(t, png.Encode(&data, stdimage.NewRGBA(stdimage.Rect(0, 0, 64, 64))))
	require.NoError(t, os.WriteFile(path, data.Bytes(), 0o644))
	svc := appimage.NewService(infraimage.NewTransformer(infraimage.NewEncoder()), nil, dir, "/uploads", nil)
	h := NewHandler(svc, dir, "/uploads")
	paths := []string{
		"/uploads/external-tweets/source/version/photo.png",
		"/uploads//external-tweets/source/version/photo.png",
		"/uploads/./external-tweets/source/version/photo.png",
	}
	for _, path := range paths {
		for _, suffix := range []string{"", "?w=32"} {
			rec := httptest.NewRecorder()
			h.ServeImage(rec, httptest.NewRequest(http.MethodGet, path+suffix, nil))
			require.Equal(t, 200, rec.Code)
			assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
		}
	}
	require.NoError(t, os.RemoveAll(filepath.Join(dir, "external-tweets", "source")))
	for _, path := range paths {
		for _, suffix := range []string{"", "?w=32"} {
			rec := httptest.NewRecorder()
			h.ServeImage(rec, httptest.NewRequest(http.MethodGet, path+suffix, nil))
			assert.GreaterOrEqual(t, rec.Code, 400)
			assert.NotEqual(t, data.Bytes(), rec.Body.Bytes())
		}
	}
	rec := httptest.NewRecorder()
	h.ServeImage(rec, httptest.NewRequest(http.MethodGet, "/uploads/.external-tmp/photo.png", nil))
	assert.Equal(t, 400, rec.Code)
}

// TestServeImage_NullByteInPath_Returns400 路径含 \0 → 拒绝 400。
// 用手工构造的 url.URL 注入控制字符（httptest.NewRequest 会拒绝解析含 \0 的 URL）。
func TestServeImage_NullByteInPath_Returns400(t *testing.T) {
	h := NewHandler(nil, "/tmp/uploads", "/uploads")

	req := &http.Request{Method: http.MethodGet, URL: &url.URL{Path: "/uploads/a\x00b"}}
	rec := httptest.NewRecorder()
	h.ServeImage(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

// TestServeImage_InvalidWidthParam_Returns400 无效的 w 参数 → parseParams 400。
func TestServeImage_InvalidWidthParam_Returns400(t *testing.T) {
	h := NewHandler(nil, "/tmp/uploads", "/uploads")

	req := httptest.NewRequest(http.MethodGet, "/uploads/img.png?w=abc", nil)
	rec := httptest.NewRecorder()
	h.ServeImage(rec, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), "w 参数无效")
}

// TestServeImage_NotFound_Returns404 无参数直传：文件不存在 → http.ServeFile 404。
func TestServeImage_NotFound_Returns404(t *testing.T) {
	dir := t.TempDir()
	h := NewHandler(nil, dir, "/uploads")

	req := httptest.NewRequest(http.MethodGet, "/uploads/missing.png", nil)
	rec := httptest.NewRecorder()
	h.ServeImage(rec, req)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

// TestServeImage_ServesOriginalFile_Returns200 无参数直传：文件存在 → 200，
// 响应体为文件内容（验证 serveOriginal 成功路径，全程不触碰 svc）。
func TestServeImage_ServesOriginalFile_Returns200(t *testing.T) {
	dir := t.TempDir()
	content := []byte("PNG-FAKE-BYTES")
	require.NoError(t, os.WriteFile(filepath.Join(dir, "logo.png"), content, 0o644))
	h := NewHandler(nil, dir, "/uploads")

	req := httptest.NewRequest(http.MethodGet, "/uploads/logo.png", nil)
	rec := httptest.NewRecorder()
	h.ServeImage(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, content, rec.Body.Bytes())
}

func TestServeImageRejectsInvalidQuality(t *testing.T) {
	h := NewHandler(nil, t.TempDir(), "/uploads")
	for _, quality := range []string{"0", "101", "-1", "abc", "80.5"} {
		rec := httptest.NewRecorder()
		h.ServeImage(rec, httptest.NewRequest(http.MethodGet, "/uploads/img.png?w=32&format=webp&quality="+quality, nil))
		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Contains(t, rec.Body.String(), "quality 参数无效")
	}
}

func TestServeImageRequestQualityAndConditionalCache(t *testing.T) {
	dir := t.TempDir()
	img := stdimage.NewNRGBA(stdimage.Rect(0, 0, 64, 64))
	for y := range 64 {
		for x := range 64 {
			img.SetNRGBA(x, y, color.NRGBA{R: byte(x * 4), G: byte(y * 4), B: byte(x * y), A: 255})
		}
	}
	var source bytes.Buffer
	require.NoError(t, png.Encode(&source, img))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "image.png"), source.Bytes(), 0o600))
	svc := appimage.NewService(infraimage.NewTransformer(infraimage.NewEncoder()), infraimage.NewMemoryCache(nil), dir, "/uploads", nil)
	defer svc.Close()
	h := NewHandler(svc, dir, "/uploads")
	url := "/uploads/image.png?w=32&format=webp&quality=80"
	first := httptest.NewRecorder()
	h.ServeImage(first, httptest.NewRequest(http.MethodGet, url, nil))
	require.Equal(t, http.StatusOK, first.Code)
	require.Equal(t, "image/webp", first.Header().Get("Content-Type"))
	require.Equal(t, "public, no-cache", first.Header().Get("Cache-Control"))
	require.NotEmpty(t, first.Header().Get("ETag"))
	decoded, _, err := stdimage.Decode(bytes.NewReader(first.Body.Bytes()))
	require.NoError(t, err)
	require.Equal(t, stdimage.Rect(0, 0, 32, 32), decoded.Bounds())
	repeat := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("If-None-Match", first.Header().Get("ETag"))
	h.ServeImage(repeat, req)
	require.Equal(t, http.StatusNotModified, repeat.Code)
	require.Empty(t, repeat.Body.Bytes())
	changed := httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/uploads/image.png?w=32&format=webp&quality=20", nil)
	req.Header.Set("If-None-Match", first.Header().Get("ETag"))
	h.ServeImage(changed, req)
	require.Equal(t, http.StatusOK, changed.Code)
	require.NotEqual(t, first.Header().Get("ETag"), changed.Header().Get("ETag"))
	require.NotEqual(t, first.Body.Bytes(), changed.Body.Bytes())
}
