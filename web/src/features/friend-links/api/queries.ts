import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "./client";
import { friendLinkPublicKeys } from "./keys";

/**
 * useFriendLinks - 公开友链列表 hook
 *
 * 单一公开维度、无参数：staleTime 与模块其他公开列表保持一致
 * （后台审核通过后短时内可能不一致，可接受——访客无强一致需求）。
 *
 * @returns React Query 结果对象
 */
export const useFriendLinks = () =>
	useQuery({
		queryKey: friendLinkPublicKeys.list(),
		queryFn: api.fetchFriendLinks,
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

/**
 * useApplyFriendLink - 调 POST /friend-links 提交申请
 *
 * 错误处理：直接 toast 后端 message（409 业务消息 / 网络错兜底文案），
 * onSuccess 由 ApplyDialog 控制 step 翻面 + 翻面邮戳动画，
 * 不在本 hook 弹通用 toast——避免与「递出名片」高潮动画抢戏。
 */
export const useApplyFriendLink = () =>
	useMutation({
		mutationFn: api.createFriendLink,
		onError: (e: Error) => {
			toast.error(e.message || "提交失败，请重试");
		},
	});
