import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * AdminSidebarState - 桌面侧边栏状态
 *
 * persist 到 localStorage（key: admin-sidebar），刷新后保持。
 * collapsed 由桌面 AdminSidebar 消费；移动端抽屉为覆盖式，不参与收起。
 *
 * expandedGroups 记录用户对父项（带 children 的导航项）展开/折叠的手动意图，
 * 以父项 to 路径为键：undefined = 未操作（跟随路由命中自动展开），
 * true = 强制展开，false = 强制折叠。手动状态优先于命中路由，用户折叠后
 * 即使命中子路由也保持折叠，兑现「手动折叠后记录为 false」语义。
 */
export interface AdminSidebarState {
    collapsed: boolean;
    toggle: () => void;
    /** 父项 to → 用户手动展开/折叠意图（undefined 表示未操作，跟随路由） */
    expandedGroups: Record<string, boolean>;
    /** 显式设置某父项的展开/折叠态（基于组件当前显示态翻转后传入） */
    setGroupExpanded: (to: string, expanded: boolean) => void;
}

export const useAdminSidebarStore = create<AdminSidebarState>()(
    persist(
        (set) => ({
            collapsed: false,
            toggle: () => set((s) => ({ collapsed: !s.collapsed })),
            expandedGroups: {},
            setGroupExpanded: (to, expanded) =>
                set((s) => ({
                    expandedGroups: {
                        ...s.expandedGroups,
                        [to]: expanded,
                    },
                })),
        }),
        { name: "admin-sidebar" },
    ),
);

