// 动画 Outlet 组件
// 替代 react-router 的静态 Outlet，实现路由切换时的过渡动画
// 使用 useOutlet 获取当前路由匹配的元素，配合 AnimatePresence 管理进出动画

import { useOutlet, useLocation } from "react-router"
import { AnimatePresence } from "motion/react"
import { PageTransition } from "./PageTransition"

/**
 * 动画路由出口组件
 * 用法：在布局组件中用 <AnimatedOutlet /> 替代 <Outlet />
 * 页面切换时自动播放过渡动画
 */
export function AnimatedOutlet() {
  const location = useLocation()
  const outlet = useOutlet()

  return (
    <AnimatePresence mode="wait">
      {/* 使用 pathname 作为 key，路径变化时触发退出/进入动画 */}
      <PageTransition key={location.pathname} pathname={location.pathname}>
        {outlet}
      </PageTransition>
    </AnimatePresence>
  )
}
