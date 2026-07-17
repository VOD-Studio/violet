import { create } from "zustand";

/**
 * LoginDialogState - 全局登录弹窗显隐状态
 *
 * LoginDialog 常驻 __root，由两路触发 open：
 * - 用户主动点击 Header 的「登录」按钮
 * - http 拦截器在受保护请求收到 401 时直接打开（opaque session 下无 refresh）
 *
 * 放在 shared/api 是因为它是 HTTP 401 拦截器的直接协作者（http.ts 在 401 时
 * 调用 open()），属于 API 基础设施的一部分，依赖方向应为 shared ← features。
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
