/**
 * 路由认证中间件
 * 用于 react-router loader 检查用户登录状态
 */

import { redirect } from "react-router"
import { useAuthStore } from "@/store"

/**
 * 管理员路由 loader
 * 检查认证状态和管理员权限，未认证或非管理员重定向到登录页
 */
export function adminLoader() {
  const { token, expiresAt, user } = useAuthStore.getState()

  // 检查 token 是否存在且未过期
  if (!token || (expiresAt && expiresAt < Date.now())) {
    return redirect("/login")
  }

  // 检查是否是管理员
  if (user?.role !== "admin") {
    return redirect("/login")
  }

  return null
}

/**
 * 用户路由 loader（个人中心等）
 * 检查认证状态，未认证重定向到登录页
 */
export function authLoader() {
  const { token, expiresAt } = useAuthStore.getState()

  // 检查 token 是否存在且未过期
  if (!token || (expiresAt && expiresAt < Date.now())) {
    return redirect("/login")
  }

  return null
}