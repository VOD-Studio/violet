import { create } from "zustand";

/**
 * API 文档纸弹窗的全局显隐状态。
 *
 * 弹窗常驻 __root，两路触发 open：首页序章的图标入口、键入序列彩蛋。
 */
interface ApiDocsDialogState {
	isOpen: boolean;
	open: () => void;
	close: () => void;
}

export const useApiDocsDialogStore = create<ApiDocsDialogState>((set) => ({
	isOpen: false,
	open: () => set({ isOpen: true }),
	close: () => set({ isOpen: false }),
}));
