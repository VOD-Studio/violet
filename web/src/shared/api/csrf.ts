import { getCookie } from "../lib/cookies";

/** CSRF header 名（与后端 middleware/csrf.go 的 CSRFHeaderName 一致） */
export const CSRF_HEADER = "X-CSRF-Token";

/** CSRF cookie 名（与后端 config CookieConfig.CSRFName 一致） */
export const CSRF_COOKIE = "mimo_csrf";

/**
 * getCSRFToken - 读取当前 CSRF token（从非 HttpOnly 的 mimo_csrf cookie）
 *
 * httpClient 的 request interceptor 调用此函数，
 * 把 token 注入到 X-CSRF-Token header，配合后端 double-submit 校验：
 * 浏览器自动带 cookie + JS 显式回传 header，攻击者跨域读不到 cookie 故无法伪造。
 *
 * token 缺失时返回空串——后端会对 state-changing 请求返回 403，
 * 客户端应在首次访问时先调 GET /auth/csrf-token 取初始 token。
 *
 * @returns CSRF token 字符串，未取到返回空串
 */
export const getCSRFToken = (): string => getCookie(CSRF_COOKIE);
