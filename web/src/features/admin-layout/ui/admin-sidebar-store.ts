import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * AdminSidebarState - 桌面侧边栏状态
 *
 * persist 到 localStorage（key: admin-sidebar），刷新后保持。
 * collapsed 由桌面 AdminSidebar 消费；移动端抽屉为覆盖式，不参与收起。
 *
 * expandedGroups 记录哪些父项（带 children 的导航项）的子菜单处于展开态，
 * 以父项 to 路径为键。当前路由命中某子项时，父项自动展开（渲染侧保证），
 * 用户手动折叠后记录为 false。
 */
export interface AdminSidebarState {
    collapsed: boolean;
    toggle: () => void;
    /** 父项 to → 是否展开 */
    expandedGroups: Record<string, boolean>;
    /** 切换某父项的展开/折叠 */
    toggleGroup: (to: string) => void;
}

export const useAdminSidebarStore = create<AdminSidebarState>()(
    persist(
        (set) => ({
            collapsed: false,
            toggle: () => set((s) => ({ collapsed: !s.collapsed })),
            expandedGroups: {},
            toggleGroup: (to) =>
                set((s) => ({
                    expandedGroups: {
                        ...s.expandedGroups,
                        [to]: !s.expandedGroups[to],
                    },
                })),
        }),
        { name: "admin-sidebar" },
    ),
);
