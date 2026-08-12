import { apiGet, apiPost } from "@shared/api/request";
import type {
	CreateFriendLinkBody,
	FriendLinkPublicDTO,
	SendFriendLinkCodeBody,
} from "../model/types";

const PUBLIC_BASE = "/friend-links";

/**
 * fetchFriendLinks - 调 GET /friend-links 获取全部已审核友链
 *
 * 后端按 sort_order 升序、同权重按 created_at 升序返回，前端原样渲染不重排。
 * 404（如路由尚未上线）走 httpClient 的 envelope 解包失败抛 ApiError，
 * 调用方按需捕获——本 hook 不做兜底重试。
 *
 * @returns 友链数组（仅 approved）
 */
export const fetchFriendLinks = async (): Promise<FriendLinkPublicDTO[]> =>
	apiGet<FriendLinkPublicDTO[]>(PUBLIC_BASE);

/**
 * sendFriendLinkCode - 调 POST /friend-links/code 发送邮箱验证码
 *
 * 仅匿名轨道使用。登录轨不调此端点（后端由 session 跳过验证码）。
 * 后端挂在 FriendLinkCodeRateLimit 限流下（防邮件轰炸）。
 *
 * @param body 收码邮箱
 */
export const sendFriendLinkCode = async (body: SendFriendLinkCodeBody): Promise<void> =>
	apiPost<void>(`${PUBLIC_BASE}/code`, body);

/**
 * createFriendLink - 调 POST /friend-links 提交申请
 *
 * 双轨共用：匿名带 code + contact_email，登录省略 code。
 * 后端返回 201 + FriendLinkPublicDTO（但 pending 不进公开列表，
 * 前端只用来表示「申请已被接收」，不直接消费）。
 *
 * 409 抛 ApiError(message = "你的申请正在审核中" / "该站点已在友链列表或审核中")，
 * 调用方用 toast.error 直接展示 err.message。
 *
 * @param body 申请字段
 */
export const createFriendLink = async (body: CreateFriendLinkBody): Promise<void> =>
	apiPost<void>(PUBLIC_BASE, body);
