import { ApiError } from "@shared/api/error";

import { useLinkConfirmStore } from "../model/link-confirm-store";

/**
 * 尝试将 OAuth 登录错误转接为绑定确认弹窗。
 *
 * 命中 409 LINK_CONFIRMATION_REQUIRED 时打开全局 LinkConfirmDialog 并返回 true，
 * 调用方据此短路原有的 toast 错误提示；非该错误返回 false 走原逻辑。
 * 三处登录入口（登录弹窗/登录页/GitHub 回调页）共用。
 *
 * @param err OAuth 登录 mutation 的 onError 错误
 * @returns 是否已转接为确认弹窗
 */
export function openLinkConfirmFromError(err: unknown): boolean {
	if (!(err instanceof ApiError) || err.status !== 409) return false;
	if (err.code !== "LINK_CONFIRMATION_REQUIRED" || !err.data) return false;
	const d = err.data;
	if (!d.link_token) return false;
	useLinkConfirmStore.getState().open({
		linkToken: String(d.link_token),
		email: String(d.email ?? ""),
		hasPassword: Boolean(d.has_password),
		provider: String(d.provider ?? ""),
	});
	return true;
}
