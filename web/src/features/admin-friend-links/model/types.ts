/**
 * admin-friend-links 模块类型定义
 *
 * 对齐后端 application/friendlink/dto.go 的 FriendLinkAdminDTO：
 * Go DTO 空值序列为空串而非 null（avatar_url / description / owner_name /
 * linkback_url / contact_email / user_id 均为 string，空串表示未填）。
 */

/** FriendLinkStatus - 友链四态状态机（approved 是唯一前台展示态） */
export type FriendLinkStatus = "pending" | "approved" | "rejected" | "disabled";

/** FriendLinkAdminDTO - 后台友链管理读模型 */
export interface FriendLinkAdminDTO {
	id: string;
	/** 站点名称 */
	name: string;
	/** 站点 URL */
	url: string;
	/** 头像 URL，空串则前端首字符占位 */
	avatar_url: string;
	/** 一句话描述 */
	description: string;
	/** 站长称呼 */
	owner_name: string;
	/** 排序值（越小越靠前） */
	sort_order: number;
	/** 四态状态机 */
	status: FriendLinkStatus;
	/** 联系邮箱（仅留存不公开） */
	contact_email: string;
	/** 回链页地址（审核参考） */
	linkback_url: string;
	/** 登录申请者 id；匿名申请与手动添加为空串 */
	user_id: string;
	created_at: string;
	updated_at: string;
}

/** FriendLinkListQuery - 后台友链列表查询参数 */
export interface FriendLinkListQuery {
	/** 页码，从 1 开始 */
	page?: number;
	/** 每页条数 */
	limit?: number;
	/** 状态筛选；省略 = 全部 */
	status?: FriendLinkStatus;
}

/**
 * FriendLinkManualRequest - 手动添加 / 编辑友链请求体
 *
 * 与后端 manualRequest 同形：未填字段发空串，sort_order 为整数。
 * 手动添加直接 approved；编辑整体替换这些字段。
 */
export interface FriendLinkManualRequest {
	name: string;
	url: string;
	avatar_url: string;
	description: string;
	owner_name: string;
	linkback_url: string;
	contact_email: string;
	sort_order: number;
}
