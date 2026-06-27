/**
 * 401 并发 refresh 队列
 *
 * 避免多个并发请求各自打 /auth/refresh 导致 cookie 互踩：
 * 第一个 401 触发 refresh，后续 401 请求 await 同一个 promise，
 * refresh 完成后所有请求用新 cookie 重放。
 *
 * 注意：此模块是 client 单例。SSR 端每请求独立 axios 实例，
 * 不共享此队列（SSR 不做自动 refresh，让请求失败由调用方处理）。
 */

let refreshing: Promise<boolean> | null = null;

/**
 * triggerRefresh - 触发 refresh 并去重
 *
 * 多个并发调用会共享同一个 promise（同一个 refresh 请求），
 * 避免后端发多个 refresh 导致 token 互踩（refresh 会让旧 token 失效）。
 *
 * @param doRefresh 实际执行 refresh 的函数（httpClient 注入）
 * @returns refresh 是否成功（true=可重放原请求，false=需跳登录）
 */
export const triggerRefresh = (doRefresh: () => Promise<boolean>): Promise<boolean> => {
    if (refreshing) return refreshing;
    refreshing = doRefresh().finally(() => {
        refreshing = null;
    });
    return refreshing;
};
