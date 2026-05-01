/**
 * 路由认证中间件
 * 用于检查用户登录状态和 JWT token 有效性
 */

import { redirect } from "react-router"

/**
 * 获取本地存储中的认证 token
 */
export function getToken(): string | null {
  try {
    return localStorage.getItem("token")
  } catch {
    return null
  }
}

/**
 * 获取用户信息（包含 role）
 */
export function getUser(): { role?: string } | null {
  try {
    const userStr = localStorage.getItem("user_info")
    if (!userStr) return null
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

/**
 * 保存认证 token 到本地存储
 */
export function setToken(token: string): void {
  localStorage.setItem("token", token)
}

/**
 * 清除本地存储中的认证数据
 */
export function clearAuth(): void {
  localStorage.removeItem("token")
  localStorage.removeItem("refresh_token")
  localStorage.removeItem("token_expires_at")
  localStorage.removeItem("user_info")
}

/**
 * 解析 JWT token 的 payload 部分
 * 不验证签名，仅做前端解码读取过期时间等信息
 */
function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const payload = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(payload)
  } catch {
    return null
  }
}

/**
 * 检查 token 是否已过期
 */
function isTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token)
  if (!payload || typeof payload.exp !== "number") return true
  return Date.now() >= payload.exp * 1000
}

/**
 * 管理员路由 loader
 * 检查认证状态和管理员权限，未认证或非管理员重定向到登录页
 */
export function adminLoader() {
  const token = getToken()
  const user = getUser()

  if (!token || isTokenExpired(token)) {
    clearAuth()
    return redirect("/login")
  }

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
  const token = getToken()

  if (!token || isTokenExpired(token)) {
    clearAuth()
    return redirect("/login")
  }

  return null
}