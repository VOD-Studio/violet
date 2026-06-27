// Package image 提供 GET /uploads/{path} 图片服务 handler。
//
// 无参数时直传原文件(immutable 缓存);有参数时动态处理(resize/thumb/rotate/转码),
// 经 application/image.Service(二级缓存 + singleflight)处理后返回,带 ETag/304。
package image

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	appimage "blog-api/internal/application/image"
	domainimage "blog-api/internal/domain/image"
	"blog-api/internal/interfaces/http/response"
)

// Handler 图片服务 handler
type Handler struct {
	svc       *appimage.Service
	uploadDir string
}

// NewHandler 创建图片服务 handler
func NewHandler(svc *appimage.Service, uploadDir string) *Handler {
	return &Handler{svc: svc, uploadDir: uploadDir}
}

// ServeImage GET /uploads/{path}
func (h *Handler) ServeImage(w http.ResponseWriter, r *http.Request) {
	relPath := r.URL.Path // /uploads/xxx
	// 路径安全:拒 ..、\0、绝对路径、.cache 目录
	if strings.Contains(relPath, "..") || strings.Contains(relPath, "\x00") || strings.Contains(relPath, "/.cache/") {
		response.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "非法路径"})
		return
	}

	params, hasParams, err := parseParams(r)
	if err != nil {
		response.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	// 无参数:直传原文件
	if !hasParams {
		h.serveOriginal(w, r, relPath)
		return
	}

	// 动态处理
	result, err := h.svc.Serve(relPath, params)
	if err != nil {
		// 解码/处理失败返回 422(不降级返回原字节,防内容混淆)
		response.WriteJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "图片处理失败"})
		return
	}
	if len(result.Bytes) == 0 {
		// 未命中且未处理出结果(理论上不会发生),降级直传原图
		h.serveOriginal(w, r, relPath)
		return
	}

	// ETag / 304
	etag := `"` + result.ETag + `"`
	if match := r.Header.Get("If-None-Match"); match == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Header().Set("Content-Type", result.MimeType)
	w.Header().Set("ETag", etag)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Write(result.Bytes)
}

// serveOriginal 直传原文件(无参数路径)
func (h *Handler) serveOriginal(w http.ResponseWriter, r *http.Request, relPath string) {
	abs := filepath.Join(h.uploadDir, strings.TrimPrefix(relPath, "/uploads"))
	clean, err := filepath.Abs(filepath.Clean(abs))
	if err != nil {
		response.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	// 路径安全：clean 必须仍在 uploadDir（转成绝对路径后）之下
	root, err := filepath.Abs(h.uploadDir)
	if err != nil || !strings.HasPrefix(clean, root) {
		response.WriteJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeFile(w, r, clean)
}

// parseParams 解析 query 参数,返回 params + 是否有处理参数。
// 参数无效返回 error(调用方映射为 400)。
func parseParams(r *http.Request) (domainimage.TransformParams, bool, error) {
	p := domainimage.TransformParams{}
	hasParams := false
	q := r.URL.Query()

	if v := q.Get("w"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 4096 {
			return p, false, fmt.Errorf("w 参数无效")
		}
		p.Width = n
		hasParams = true
	}
	if v := q.Get("h"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 4096 {
			return p, false, fmt.Errorf("h 参数无效")
		}
		p.Height = n
		hasParams = true
	}
	if v := q.Get("format"); v != "" {
		if v != "jpeg" && v != "png" && v != "webp" {
			return p, false, fmt.Errorf("format 参数无效")
		}
		p.Format = v
		hasParams = true
	}
	if v := q.Get("quality"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 100 {
			return p, false, fmt.Errorf("quality 参数无效")
		}
		p.Quality = n
	}
	if v := q.Get("rotate"); v != "" {
		switch v {
		case "0", "90", "180", "270":
			p.Rotate, _ = strconv.Atoi(v)
			hasParams = true
		default:
			return p, false, fmt.Errorf("rotate 参数无效")
		}
	}
	if v := q.Get("thumb"); v != "" {
		parts := strings.SplitN(v, "x", 2)
		if len(parts) != 2 {
			return p, false, fmt.Errorf("thumb 参数无效")
		}
		tw, err1 := strconv.Atoi(parts[0])
		th, err2 := strconv.Atoi(parts[1])
		if err1 != nil || err2 != nil || tw <= 0 || th <= 0 || tw*th > 25000000 {
			return p, false, fmt.Errorf("thumb 参数无效")
		}
		p.ThumbW = tw
		p.ThumbH = th
		hasParams = true
	}
	return p, hasParams, nil
}
