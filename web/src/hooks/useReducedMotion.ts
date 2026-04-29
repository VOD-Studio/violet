// 检测用户是否偏好减少动画
// 监听 prefers-reduced-motion 媒体查询变化

import { useState, useEffect } from "react"

/** 检测 prefers-reduced-motion 偏好，实时监听变化 */
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  })

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")

    // 监听偏好变化
    function handleChange(event: MediaQueryListEvent) {
      setPrefersReduced(event.matches)
    }

    mq.addEventListener("change", handleChange)
    return () => mq.removeEventListener("change", handleChange)
  }, [])

  return prefersReduced
}
