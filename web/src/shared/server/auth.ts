import type { AxiosInstance } from "axios";

import { createHttpClient } from "../api/http";
import { getForwardedCookie } from "./cookies";

/**
 * getServerHttpClient - 为当前 SSR 请求创建独立 axios 实例
 *
 * Node server 是长驻进程，全局 axios 实例的 interceptor 闭包会跨请求串扰，
 * 因此每请求创建独立实例并注入该请求的 cookie header。
 *
 * 必须在 server function / loader 内调用（依赖 AsyncLocalStorage 上下文），
 * 不能在模块顶层缓存返回值。
 *
 * @returns 注入了当前请求 cookie 的 axios 实例
 */
export const getServerHttpClient = (): AxiosInstance =>
	createHttpClient({ forwardedCookie: getForwardedCookie() });
