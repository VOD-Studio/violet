// 侧边栏状态 slice
// 管理后台侧边栏折叠状态

import { create } from "zustand"

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
 */
export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: localStorage.getItem("sidebar-collapsed") === "true",

  toggle: () =>
    set((state) => {
      const next = !state.collapsed
      localStorage.setItem("sidebar-collapsed", String(next))
      return { collapsed: next }
    }),

  setCollapsed: (collapsed) => {
    localStorage.setItem("sidebar-collapsed", String(collapsed))
    set({ collapsed })
  },
}))