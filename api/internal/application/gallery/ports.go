// ports.go 定义图集用例编排依赖的端口。
//
// 抽接口而非直接依赖 upload / permission 包，便于单测注入 fake。
// 与 tweet.TweetImageChecker、chat.FileRepository 端口同构。
package gallery

import (
	"context"

	"blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
)

// GalleryMediaChecker 图集媒体校验与引用计数端口。
//
// 归属与类型校验（owner == gallery.owner 且 图片或 mp4/webm）与引用计数
// 维护（挂接 +1 / 解除 -1）都经此端口，生产实现适配 upload.FileRepository。
type GalleryMediaChecker interface {
	// CheckFilesUsable 校验 fileIDs 全部存在、就绪、归属 ownerID，且类型为图片或 mp4/webm。
	// 任一不满足返回错误（不存在/未就绪/非本人/类型不符同错，不暴露他人文件存在性）。
	CheckFilesUsable(ctx context.Context, fileIDs []shared.ID, ownerID shared.ID) error
	// UpdateRefCount 维护文件引用计数（挂接 +1 / 解除 -1）。
	UpdateRefCount(ctx context.Context, fileID shared.ID, delta int) error
	// FindByIDs 批量取文件元数据（详情/列表 DTO 组装）；不存在的 ID 不在结果中。
	FindByIDs(ctx context.Context, fileIDs []shared.ID) (map[shared.ID]*domainupload.File, error)
}

// GalleryPermissionChecker 权限检查端口（避免直接依赖 permission service 包）。
type GalleryPermissionChecker interface {
	HasPermission(role string, isBuiltinSuperAdmin bool, codes ...string) bool
}
