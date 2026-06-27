import { create } from "zustand";

/**
 * CommandUIState - 命令面板显隐状态
 *
 * CommandPalette 是常驻 __root 的全局组件，
 * 由 Cmd/Ctrl+K 或 HeaderActions 的命令按钮调用 open() 切换。
 * 与 MusicUIStore 同模式（zustand 单例，不持久化）。
 */
export interface CommandUIState {
    /** 是否打开 */
    isOpen: boolean;
    /** 打开面板 */
    open: () => void;
    /** 关闭面板 */
    close: () => void;
    /** 切换显隐 */
    toggle: () => void;
}

export const useCommandUIStore = create<CommandUIState>((set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
    toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
