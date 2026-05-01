// 侧边栏状态 slice
// 管理后台侧边栏折叠状态
// 使用 persist 中间件自动持久化到 localStorage

import { create } from "zustand"
import { persist } from "zustand/middleware"

/** 侧边栏状态接口 */
interface SidebarState {
  /** 侧边栏是否折叠 */
  collapsed: boolean
  /** 切换折叠状态 */
  toggle: () => void
  /** 设置折叠状态 */
  setCollapsed: (collapsed: boolean) => void
}

/**
 * 侧边栏状态 store
 * 使用 persist 中间件自动同步 localStorage
 */
export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,

      toggle: () => set((state) => ({ collapsed: !state.collapsed })),

      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    {
      name: "sidebar-storage",
    },
  ),
)