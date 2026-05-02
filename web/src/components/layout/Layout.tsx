// 前台布局包装组件
// 组合 Header、页面内容和 Footer，提供统一的页面结构
// 使用 AnimatedOutlet 实现页面切换过渡动画

import { Header } from "./Header";
import { Footer } from "./Footer";
import { AnimatedOutlet } from "./AnimatedOutlet";
import { SidebarWidgets } from "@/components/shared/SidebarWidgets";

/**
 * 前台布局组件
 * 使用 AnimatedOutlet 渲染子路由内容，支持页面过渡动画
 * Header 固定在顶部，Footer 在底部
 * SidebarWidgets 统一管理悬浮侧边组件（音乐播放器、回到顶部等）
 */
export function Layout() {
  return (
    <div className="flex min-h-svh flex-col">
      {/* 顶部导航栏 */}
      <Header />

      {/* 主内容区域，自动撑满剩余空间，切换路由时播放过渡动画 */}
      <main className="flex-1">
        <AnimatedOutlet />
      </main>

      {/* 底部信息栏 */}
      <Footer />

      {/* 悬浮侧边组件集合 */}
      <SidebarWidgets />
    </div>
  );
}
