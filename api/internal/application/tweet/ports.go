// ports.go 定义推文用例编排依赖的端口。
//
// 抽接口而非直接依赖 upload / permission 包，便于单测注入 fake。
// 这是 application 层依赖反转的标准模式（与 mcp.PostService、
// post.PostPermissionChecker 端口同构）。
package tweet

import (
	"context"

	"blog-api/internal/domain/shared"
)

// TweetImageChecker 推文图片归属校验端口。
//
// 发布时校验每个 image URL 在 upload 域存在、就绪且归属作者，
// 防越权引用他人上传文件（生产实现适配 upload.FileRepository）。
type TweetImageChecker interface {
	// CheckImagesOwnedBy 校验 urls 全部存在、就绪且 owner 为 authorID。
	// 任一不满足返回错误（不存在/未就绪/非本人同错，不暴露他人文件存在性）。
	CheckImagesOwnedBy(ctx context.Context, urls []string, authorID shared.ID) error
}

// TweetPermissionChecker 权限检查端口（避免直接依赖 permission service 包）。
type TweetPermissionChecker interface {
	HasPermission(role string, isBuiltinSuperAdmin bool, codes ...string) bool
}
