package bilibili

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Downloader 将 B站表情图片下载到本地存储。
// 物理目录 emojiDir 与 URL 前缀 urlPrefix 解耦（不互推）。
type Downloader struct {
	emojiDir   string
	urlPrefix  string
	httpClient *http.Client
	userAgent  string
}

// NewDownloader 创建图片下载器。内部确保 emojiDir 存在。
func NewDownloader(emojiDir, urlPrefix string) *Downloader {
	_ = os.MkdirAll(emojiDir, 0755)
	return &Downloader{
		emojiDir:   emojiDir,
		urlPrefix:  urlPrefix,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		userAgent:  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
	}
}

// Download 下载单张图片到 emojiDir，返回可访问的本地 URL（urlPrefix + "emojis/" + filename）。
// 从 URL 和 Content-Type 推断扩展名（gif/jpg/png/webp）。
func (d *Downloader) Download(url string) (string, error) {
	if url == "" {
		return "", fmt.Errorf("下载 URL 为空")
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("创建下载请求失败: %w", err)
	}
	req.Header.Set("User-Agent", d.userAgent)
	req.Header.Set("Referer", "https://www.bilibili.com")

	resp, err := d.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("下载失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("下载失败: status=%d", resp.StatusCode)
	}

	ext := ".png"
	if strings.Contains(url, ".gif") {
		ext = ".gif"
	} else if ct := resp.Header.Get("Content-Type"); ct != "" {
		switch ct {
		case "image/gif":
			ext = ".gif"
		case "image/jpeg", "image/jpg":
			ext = ".jpg"
		case "image/webp":
			ext = ".webp"
		}
	}

	filename := uuid.New().String() + ext
	dstPath := filepath.Join(d.emojiDir, filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		return "", fmt.Errorf("创建文件失败: %w", err)
	}
	defer dst.Close()

	if _, err = io.Copy(dst, resp.Body); err != nil {
		os.Remove(dstPath)
		return "", fmt.Errorf("保存文件失败: %w", err)
	}

	return d.urlPrefix + "emojis/" + filename, nil
}
