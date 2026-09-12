import { create } from "zustand";

/**
 * 供登录入口和 HTTP 会话过期处理共用的非持久化弹窗状态。
 *
 * 自动打开仅针对已登录会话的 401；游客由交互入口主动打开。
 */
export interface LoginDialogState {
	/** 是否打开 */
	isOpen: boolean;
	/** 打开弹窗 */
	open: () => void;
	/** 关闭弹窗 */
	close: () => void;
}

export const useLoginDialogStore = create<LoginDialogState>((set) => ({
	isOpen: false,
	open: () => set({ isOpen: true }),
	close: () => set({ isOpen: false }),
}));
