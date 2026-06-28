/**
 * 401 并发 refresh 队列
 *
 * 避免多个并发请求各自打 /auth/refresh 导致 cookie 互踩：
 * 第一个 401 触发 refresh，后续 401 请求 await 同一个 promise，
 * refresh 完成后所有请求用新 cookie 重放。
 *
 * 返回值：refresh 成功时返回新的 expires_in（秒，供主动刷新调度器重新 arm 定时器），
 * 失败返回 null。调用方据此决定重放 / 弹窗，以及是否续期。
 *
 * 注意：此模块是 client 单例。SSR 端每请求独立 axios 实例，
 * 不共享此队列（SSR 不做自动 refresh，让请求失败由调用方处理）。
 */

let refreshing: Promise<number | null> | null = null;

/**
 * triggerRefresh - 触发 refresh 并去重
 *
 * 多个并发调用会共享同一个 promise（同一个 refresh 请求），
 * 避免后端发多个 refresh 导致 token 互踩（refresh 会让旧 token 失效）。
 *
 * @param doRefresh 实际执行 refresh 的函数（httpClient 注入）；
 *                  成功返回新 expires_in（秒），失败返回 null
 * @returns 新 expires_in（成功，可重放原请求）/ null（失败，需弹登录）
 */
export const triggerRefresh = (doRefresh: () => Promise<number | null>): Promise<number | null> => {
    if (refreshing) return refreshing;
    refreshing = doRefresh().finally(() => {
        refreshing = null;
    });
    return refreshing;
};
