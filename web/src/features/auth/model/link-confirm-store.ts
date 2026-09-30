import { create } from "zustand";

/** OAuth 首次匹配确认流的状态（409 LINK_CONFIRMATION_REQUIRED 响应体） */
export interface LinkConfirmPayload {
	linkToken: string;
	/** 已脱敏邮箱（a***@x.com），仅展示用 */
	email: string;
	/** false=账号无密码，引导走忘记密码补设后回来绑定 */
	hasPassword: boolean;
	/** 提供方展示名 */
	provider: string;
}

interface LinkConfirmState {
	payload: LinkConfirmPayload | null;
	open: (payload: LinkConfirmPayload) => void;
	close: () => void;
}

/**
 * useLinkConfirmStore - OAuth 绑定确认弹窗状态
 *
 * 409 可产生于三处登录入口（登录弹窗/登录页/GitHub 回调页），
 * 弹窗全局挂载在 __root，经此 store 触发。
 */
export const useLinkConfirmStore = create<LinkConfirmState>((set) => ({
	payload: null,
	open: (payload) => set({ payload }),
	close: () => set({ payload: null }),
}));
