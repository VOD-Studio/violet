import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * getForwardedCookie - 从 SSR 入口请求读取 cookie header
 *
 * SSR server 端调用后端 API 时，必须把浏览器发来的 cookie 原样转发，
 * 让后端 auth middleware 从 cookie 读 session id 鉴权。
 *
 * 实现：读 entry request 的 Cookie header，传给 createHttpClient 的
 * forwardedCookie 参数，注入到该请求的 axios 实例。
 *
 * 仅在 server function / loader 内调用有效（依赖 AsyncLocalStorage 上下文）。
 *
 * @returns 完整的 Cookie header 字符串（如 "mimo_session=xxx; mimo_csrf=yyy"），无则空串
 */
export const getForwardedCookie = (): string => getRequestHeader("cookie") ?? "";
