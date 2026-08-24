// Package customemoji 提供自定义表情用例服务：自助上传/删除/收藏，以及供
// comment/tweet/chat 三域共享的按 ID 批量解析（ResolveByIDs）。
package customemoji

import "context"

// QuotaPolicy 表情份额上限查询端口。
//
// 由 wiring 适配 settings 模块（site_settings.custom_emoji_max_per_user）+
// env 变量兜底（CUSTOM_EMOJI_MAX_PER_USER，默认 100），实现方在 app 容器层。
type QuotaPolicy interface {
	MaxPerUser(ctx context.Context) (int, error)
}

// PermissionChecker 权限检查端口（避免直接依赖 permission service 包，
// 与 apptweet.TweetPermissionChecker 同构）。
type PermissionChecker interface {
	HasPermission(role string, isBuiltinSuperAdmin bool, codes ...string) bool
}

// ManagePermission 管理员强制下架任意用户自定义表情的权限码（migration 094 seed）。
const ManagePermission = "customemoji:manage"
