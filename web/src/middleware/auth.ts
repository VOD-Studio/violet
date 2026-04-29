/**
 * 路由认证中间件
 * 用于检查用户登录状态和 JWT token 有效性
 */

import { redirect } from "react-router"

/**
 * 获取本地存储中的认证 token
 * @returns token 字符串，不存在则返回 null
 */
export function getToken(): string | null {
  try {
    return localStorage.getItem("token")
  } catch {
    return null
  }
}

/**
 * 保存认证 token 到本地存储
 * @param token - JWT token 字符串
 */
export function setToken(token: string): void {
  localStorage.setItem("token", token)
}

/**
 * 清除本地存储中的认证 token
 */
export function clearToken(): void {
  localStorage.removeItem("token")
}

/**
 * 解析 JWT token 的 payload 部分
 * 不验证签名，仅做前端解码读取过期时间等信息
 * @param token - JWT token 字符串
 * @returns 解析后的 payload 对象，解析失败返回 null
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
 * @param token - JWT token 字符串
 * @returns 已过期返回 true，未过期或解析失败返回 false
 */
function isTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token)
  if (!payload || typeof payload.exp !== "number") return true
  return Date.now() >= payload.exp * 1000
}

/**
 * 检查用户是否已认证且 token 有效
 * 用于路由保护的 loader 函数
 * @throws 未认证或 token 过期时重定向到登录页
 */
export function requireAuth(): void {
  const token = getToken()

  if (!token) {
    throw redirect("/login")
  }

  if (isTokenExpired(token)) {
    clearToken()
    throw redirect("/login")
  }
}

/**
 * 管理员路由的 loader 函数
 * 用于保护所有 /admin/* 路由
 */
export function adminLoader() {
  requireAuth()
  return null
}
