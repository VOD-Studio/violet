// Package image 定义图片动态服务的领域端口(按需处理/缓存)。
//
// 与 domain/upload.ImageProcessor(上传时一次性转码)区分:
// 本端口面向"请求时按参数处理",由 application/image.Service 编排。
package image

import "fmt"

// TransformParams 动态处理参数
type TransformParams struct {
	// width 目标宽度(px);>0 时触发等比缩放(只缩不放),0 表示保持原图宽度
	Width int
	// height 目标高度(px);>0 时触发等比缩放(只缩不放),0 表示保持原图高度
	Height int
	// thumbW 缩略图宽度(px);需与 thumbH 同时 >0 才生效,强制裁剪到精确尺寸
	ThumbW int
	// thumbH 缩略图高度(px);需与 thumbW 同时 >0 才生效,强制裁剪到精确尺寸
	ThumbH int
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
	// bytes 处理后的图片二进制数据
	Bytes []byte
	// mimeType 输出内容的 MIME 类型(与 Format 对应,如 image/webp)
	MimeType string
	// etag 内容校验标识,用于客户端缓存协商(304 响应)
	ETag string
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
