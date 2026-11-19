import { apiGetPaged, apiPost } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import type {
	CreateFriendLinkBody,
	FriendLinkPublicDTO,
	FriendLinkPublicQuery,
	SendFriendLinkCodeBody,
} from "../model/types";

const PUBLIC_BASE = "/friend-links";

export const fetchFriendLinkPage = async (
	query: FriendLinkPublicQuery,
): Promise<PagedResponse<FriendLinkPublicDTO>> =>
	apiGetPaged<FriendLinkPublicDTO>(PUBLIC_BASE, { params: query });

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

/** pending 申请仅显示回执，审核通过后才进入公开列表。 */
export const createFriendLink = async (body: CreateFriendLinkBody): Promise<void> =>
	apiPost<void>(PUBLIC_BASE, body);
