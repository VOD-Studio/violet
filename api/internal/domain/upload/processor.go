package upload

// ProcessResult 转码结果
type ProcessResult struct {
	Path     string // 最终落盘路径
	MimeType string // 可能从 image/jpeg 变成 image/webp
	Ext      string // 可能从 .jpg 变成 .webp
}

// ImageProcessor 图片处理端口(上传时转码/校验/尺寸/缩略图)
//
// domain 层定义端口,application 层依赖端口,infrastructure 层提供实现。
// 当前实现走纯 Go(imaging + nativewebp);未来可切换 cgo libwebp,只需替换实现。
type ImageProcessor interface {
	// Validate 校验图片有效性(magic bytes + 解码),返回真实 MIME
	Validate(path string) (mime string, err error)
	// Transcode 转 WebP;GIF/WebP 跳过,JPEG/PNG 解码后编码,
	// 仅当 WebP 更小才采用,否则回退原格式
	Transcode(srcPath, destDir, fileUUID string, srcMime string) (ProcessResult, error)
	// Dimensions 取宽高(非图片返回 0,0)
	Dimensions(path string) (w, h int)
	// Thumbnail 生成缩略图,返回 URL;不支持时返回空
	Thumbnail(srcPath, fileUUID, storageDir, mime string) string
}
