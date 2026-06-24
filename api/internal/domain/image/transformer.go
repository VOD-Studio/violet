// Package image 定义图片动态服务的领域端口(按需处理/缓存)。
//
// 与 domain/upload.ImageProcessor(上传时一次性转码)区分:
// 本端口面向"请求时按参数处理",由 application/image.Service 编排。
package image

import "fmt"

// TransformParams 动态处理参数
type TransformParams struct {
	Width   int
	Height  int
	ThumbW  int
	ThumbH  int
	Rotate  int    // 0|90|180|270
	Format  string // jpeg|png|webp
	Quality int    // 1-100
}

// Key 返回用于缓存 key 的参数序列化。
// 统一定义在 domain 层,application/infrastructure 共用,消除重复实现。
func (p TransformParams) Key() string {
	return fmt.Sprintf("w%d_h%d_tw%d_th%d_r%d_%s_q%d",
		p.Width, p.Height, p.ThumbW, p.ThumbH, p.Rotate, p.Format, p.Quality)
}

// TransformResult 处理结果
type TransformResult struct {
	Bytes    []byte
	MimeType string
	ETag     string
}

// ImageTransformer 图片动态处理端口
type ImageTransformer interface {
	// Transform 按参数处理图片;源文件不存在/解码失败返回 error
	Transform(srcPath string, params TransformParams) (TransformResult, error)
}

// ImageCache 图片处理结果缓存端口
type ImageCache interface {
	// Get 按 key 取缓存;未命中返回零值(Bytes 为 nil), nil
	Get(key string) (TransformResult, error)
	// Set 写入缓存
	Set(key string, result TransformResult) error
}
