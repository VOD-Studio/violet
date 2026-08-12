/**
 * friend-links 模块公开类型
 *
 * 对齐后端 application/friendlink/dto.go 的 FriendLinkPublicDTO：
 * GET /api/v1/friend-links 仅 approved，且可选字段序列为 null（avatar_url
 * / description / owner_name），前端据此决定是否走占位文案。
 *
 * 申请相关请求体与公开 DTO 不在一个文件——后台 FriendLinkAdminDTO
 * 已在 admin-friend-links/model/types.ts 定义，不要重复。
 */

/** FriendLinkPublicDTO - 公开友链读模型 */
export interface FriendLinkPublicDTO {
	id: string;
	/** 站点名称 */
	name: string;
	/** 站点 URL */
	url: string;
	/** 头像 URL，null 时前端首字符占位 */
	avatar_url: string | null;
	/** 一句话描述，null 时走「这位朋友什么也没写」 */
	description: string | null;
	/** 站长称呼，null 时走「佚名站长」 */
	owner_name: string | null;
	/** 站长编排的展示顺序（越小越靠前） */
	sort_order: number;
}

/**
 * SendFriendLinkCodeBody - POST /friend-links/code 请求体
 *
 * 仅匿名轨道使用：登录态跳过验证码（后端由 session 判定），
 * 因此不会调此端点。
 */
export interface SendFriendLinkCodeBody {
	email: string;
}

/**
 * CreateFriendLinkBody - POST /friend-links 申请请求体
 *
 * 双轨共用：
 * - 匿名：必填 code + contact_email
 * - 登录：省略 code（后端由 session 判定跳过校验）；contact_email 可省略
 *
 * 后端兼容空串——前端把「未填」统一序列化为 ""，由 domain 聚合根
 * 做长度/格式校验后决定是否拒绝。
 */
export interface CreateFriendLinkBody {
	name: string;
	url: string;
	avatar_url: string;
	description: string;
	owner_name: string;
	linkback_url: string;
	contact_email: string;
	/** 仅匿名轨填；登录轨省略 */
	code?: string;
}
