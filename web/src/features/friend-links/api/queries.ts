import { useMutation, useQuery } from "@tanstack/react-query";
import type { FriendLinkPublicQuery } from "../model/types";
import * as api from "./client";
import { friendLinkPublicKeys } from "./keys";

export const useFriendLinkPage = (query: FriendLinkPublicQuery) =>
	useQuery({
		queryKey: friendLinkPublicKeys.list(query),
		queryFn: () => api.fetchFriendLinkPage(query),
	});

/**
 * useSendFriendLinkCode - 匿名申请第一步：发邮箱验证码
 *
 * onError toast err.message（后端可能返回 429 限流或 400 邮箱非法），
 * 不进入冷却——ResendButton 用 onResend 返回 false 取消冷却。
 * 调用方在 ResendButton.onResend 内做前端校验，校验失败返回 false，
 * 后端失败由本 hook 的 onError 兜底 toast。
 */
export const useSendFriendLinkCode = () =>
	useMutation({
		mutationFn: api.sendFriendLinkCode,
	});

export const useApplyFriendLink = () => useMutation({ mutationFn: api.createFriendLink });
