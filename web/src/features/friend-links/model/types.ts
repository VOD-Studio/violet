import type { PageQuery } from "@shared/api/types";

/** 公开列表由服务端按文章更新时间或站长顺序排序。 */
export interface FriendLinkPublicQuery extends PageQuery {
	sort?: "updated" | "manual";
}

/** FriendLinkPublicDTO - 公开友链读模型 */
export interface FriendLinkPublicDTO {
	id: string;
	/** 站点名称 */
	name: string;
	/** 站点 URL */
	url: string;
	/** 头像缺失时由 Avatar 显示站名首字。 */
	avatar_url: string | null;
	/** 站点的一句话简介。 */
	description: string | null;
	/** 可选站长称呼。 */
	owner_name: string | null;
	/** 站长编排的展示顺序（越小越靠前） */
	sort_order: number;
	rss_url: string;
	feed_status: "no_feed" | "pending" | "ok" | "empty" | "error";
	site_status: "unchecked" | "up" | "down";
	checked_at: string | null;
	latest_title: string;
	latest_url: string;
	latest_published_at: string | null;
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
	rss_url: string;
	description: string;
	owner_name: string;
	linkback_url: string;
	contact_email: string;
	/** 仅匿名轨填；登录轨省略 */
	code?: string;
}
