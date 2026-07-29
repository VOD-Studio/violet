import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * AdminSidebarState - 桌面侧边栏收起状态
 *
 * persist 到 localStorage（key: admin-sidebar），刷新后保持。
 * 仅桌面 AdminSidebar 消费；移动端抽屉为覆盖式，不参与收起。
 */
export interface AdminSidebarState {
    collapsed: boolean;
    toggle: () => void;
}

export const useAdminSidebarStore = create<AdminSidebarState>()(
    persist(
        (set) => ({
            collapsed: false,
            toggle: () => set((s) => ({ collapsed: !s.collapsed })),
        }),
        { name: "admin-sidebar" },
    ),
);
