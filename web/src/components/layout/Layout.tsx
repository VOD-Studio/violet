// 前台布局包装组件
// 组合 Header、页面内容和 Footer，提供统一的页面结构

import { Outlet } from "react-router"
import { Header } from "./Header"
import { Footer } from "./Footer"

/**
 * 前台布局组件
 * 使用 Outlet 渲染子路由内容，Header 固定在顶部，Footer 在底部
 */
export function Layout() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* 顶部导航栏 */}
      <Header />

      {/* 主内容区域，自动撑满剩余空间 */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* 底部信息栏 */}
      <Footer />
    </div>
  )
}
