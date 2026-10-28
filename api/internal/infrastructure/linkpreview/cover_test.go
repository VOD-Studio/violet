package linkpreview

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	infraimage "blog-api/internal/infrastructure/image"
)

func TestCoverStoreKeepsImmutableVersions(t *testing.T) {
	for _, relative := range []bool{false, true} {
		name := "absolute-root"
		if relative {
			name = "relative-root"
		}
		t.Run(name, func(t *testing.T) {
			root := t.TempDir()
			if relative {
				t.Chdir(root)
				root = "uploads"
			}
			payload := coverPNG(t, color.RGBA{R: 255, A: 255})
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "image/png")
				_, _ = w.Write(payload)
			}))
			defer server.Close()
			processor := infraimage.NewProcessor(root, "/uploads/", nil, infraimage.NewEncoder())
			store := NewCoverStore(root, "/uploads/", processor, &http.Client{Transport: http.DefaultTransport})
			firstBytes := append([]byte(nil), payload...)
			first, err := store.Save(context.Background(), "https://example.com/article", server.URL)
			if err != nil {
				t.Fatal(err)
			}
			payload = coverPNG(t, color.RGBA{B: 255, A: 255})
			secondBytes := append([]byte(nil), payload...)
			second, err := store.Save(context.Background(), "https://example.com/article", server.URL)
			if err != nil {
				t.Fatal(err)
			}
			if first == second {
				t.Fatal("封面内容改变后必须换 URL，不能命中旧浏览器缓存")
			}
			for _, version := range []struct {
				url  string
				data []byte
			}{{first, firstBytes}, {second, secondBytes}} {
				data, err := os.ReadFile(filepath.Join(root, strings.TrimPrefix(version.url, "/uploads/")))
				if err != nil || !bytes.Equal(data, version.data) {
					t.Fatalf("封面版本不可读或被覆盖: %s, %v", version.url, err)
				}
			}
			payload = []byte("not an image")
			if _, err := store.Save(context.Background(), "https://example.com/article", server.URL); err == nil {
				t.Fatal("损坏的新封面不能替换已有快照")
			}
			for _, url := range []string{first, second} {
				if _, err := os.Stat(filepath.Join(root, strings.TrimPrefix(url, "/uploads/"))); err != nil {
					t.Fatal(err)
				}
			}
			temps, err := os.ReadDir(filepath.Join(root, "link-previews", ".tmp"))
			if err != nil || len(temps) != 0 {
				t.Fatalf("下载结束后必须释放临时文件: %v, %v", temps, err)
			}
		})
	}
}

func coverPNG(t *testing.T, fill color.RGBA) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 12, 10))
	for y := 0; y < 10; y++ {
		for x := 0; x < 12; x++ {
			img.SetRGBA(x, y, fill)
		}
	}
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, img); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}
