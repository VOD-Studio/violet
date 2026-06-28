import { create } from "zustand";

/**
 * LoginDialogState - 全局登录弹窗显隐状态
 *
 * LoginDialog 常驻 __root，由两路触发 open：
 * - 用户主动点击 Header 的「登录」按钮
 * - http 拦截器在 refresh 失败后经 authGate 注入的 opener（鉴权降级）
 *
 * 与 CommandUIStore 同模式（zustand 单例，不持久化）。
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
