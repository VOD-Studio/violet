package linkpreview

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	domainupload "blog-api/internal/domain/upload"
	"blog-api/internal/infrastructure/ssrf"
	"blog-api/internal/infrastructure/storage"
)

const (
	// maxCoverBytes 单张封面下载上限。
	maxCoverBytes int64 = 10 << 20
	// maxCoverPixels 封面像素上限（与上传图片同约束）。
	maxCoverPixels = 20000000
)

// coverFormats 解码格式 → 扩展名白名单（与 xtweet 媒体下载一致）。
var coverFormats = map[string]string{"jpeg": ".jpg", "png": ".png", "gif": ".gif", "webp": ".webp"}

// CoverStore 将经过校验的封面保存为不可变的内容版本，旧快照在刷新失败时仍可使用。
type CoverStore struct {
	client    *http.Client
	storage   *storage.LocalStorage
	processor domainupload.ImageProcessor
	prefix    string
	// root 临时文件和正式封面共同使用的存储根目录。
	root string
}

// NewCoverStore 构造封面存储。root/prefix 与站点上传存储一致。
//
// client 为 nil（生产）时使用 SSRF 安全传输；注入带 Transport 的 client
// 仅用于测试（httptest 监听环回，SafeTransport 会拦截）。
func NewCoverStore(root, prefix string, processor domainupload.ImageProcessor, client *http.Client) *CoverStore {
	c := http.Client{}
	if client != nil {
		c = *client
	}
	if c.Transport == nil {
		c.Transport = ssrf.NewSafeTransport()
	}
	c.Timeout = 15 * time.Second
	c.CheckRedirect = redirectPolicy
	return &CoverStore{
		client:    &c,
		storage:   storage.NewLocalStorage(root, prefix),
		processor: processor,
		prefix:    strings.TrimSuffix(prefix, "/"),
		root:      root,
	}
}

// Save 下载 srcURL 封面，落盘后返回本站访问 URL；失败返回错误（调用方按无封面降级）。
func (s *CoverStore) Save(ctx context.Context, pageURL, srcURL string) (string, error) {
	if _, err := validateTarget(srcURL); err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, srcURL, nil)
	if err != nil {
		return "", &FetchError{Reason: "cover request", Err: err}
	}
	req.Header.Set("User-Agent", "Violet-LinkPreview/1.0 (+https://xunrua.top)")
	req.Header.Set("Accept", "image/*")
	// 封面防盗链常见的 Referer 判定：携带来源页地址。
	req.Header.Set("Referer", pageURL)

	res, err := s.client.Do(req)
	if err != nil {
		return "", &FetchError{Reason: "cover download", Err: err}
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK || res.ContentLength > maxCoverBytes {
		return "", &FetchError{Reason: fmt.Sprintf("cover status %d", res.StatusCode)}
	}

	// 临时文件建在 storage root 内：storage.Move 只接受 root 内的源路径。
	tmpDir := filepath.Join(s.root, "link-previews", ".tmp")
	if err := os.MkdirAll(tmpDir, 0o755); err != nil {
		return "", err
	}
	tmp, err := os.CreateTemp(tmpDir, "cover-*")
	if err != nil {
		return "", err
	}
	tmpName := tmp.Name()
	defer func() { _ = os.Remove(tmpName) }()
	hash := sha256.New()
	if _, err := io.Copy(io.MultiWriter(tmp, hash), ssrf.LimitBody(res.Body, maxCoverBytes)); err != nil {
		tmp.Close()
		return "", &FetchError{Reason: "cover read", Err: err}
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}

	ext, err := s.validateCover(ctx, tmpName, res.Header.Get("Content-Type"))
	if err != nil {
		return "", err
	}
	key := coverKey(pageURL)
	name := hex.EncodeToString(hash.Sum(nil)) + ext
	dir := filepath.Join(s.root, "link-previews", key)
	if err := s.storage.Move(tmpName, filepath.Join(dir, name)); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s/link-previews/%s/%s", s.prefix, key, name), nil
}

// validateCover 三重校验：解码头（格式白名单 + 像素上限）、上传链完整校验
// （processor.Validate：字节/尺寸/动画累计像素/压缩内容）、响应声明 MIME 一致性。
// 返回扩展名。
func (s *CoverStore) validateCover(ctx context.Context, path, contentType string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	config, format, decodeErr := image.DecodeConfig(file)
	_ = file.Close()
	ext, ok := coverFormats[format]
	if decodeErr != nil || !ok || config.Width <= 0 || config.Height <= 0 ||
		int64(config.Width)*int64(config.Height) > maxCoverPixels {
		return "", errors.New("cover pixel limit or invalid image")
	}
	detected, err := s.processor.ForRequest(ctx).Validate(path)
	if err != nil {
		return "", &FetchError{Reason: "cover validate", Err: err}
	}
	if declared, _, perr := mime.ParseMediaType(contentType); perr == nil &&
		declared != "application/octet-stream" && declared != "" && declared != detected {
		return "", errors.New("cover MIME mismatch")
	}
	return ext, nil
}

// coverKey URL → 存储目录名（sha256 前 16 位 hex）。
func coverKey(srcURL string) string {
	sum := sha256.Sum256([]byte(srcURL))
	return hex.EncodeToString(sum[:])[:16]
}
