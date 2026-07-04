/**
 * 401 并发 refresh 队列 + 跨 tab 互斥
 *
 * 单 tab 内：多个并发 401 共享同一个 promise（单飞），避免 cookie 互踩。
 * 跨 tab：navigator.locks.request 用 queue 模式（不传 ifAvailable），锁被占用时
 * 请求排队等待，持锁 tab 释放后排队 tab 才拿锁执行 doRefresh。
 *
 * 为何用 queue 而非 ifAvailable 跳过：cookie 跨同源 tab 共享，持锁 tab 成功刷新后
 * 新 cookie 对所有 tab 可见。但「跳过的 tab」后来自己成为持锁者时，可能仍用旧
 * refresh cookie 发起刷新 → 命中后端 RotateReused → 整个家族吊销（见 ADR-0001
 * 不变量 2）。queue 模式下，后来者排队等锁，拿锁时 cookie 已是最新，用新 token
 * 刷新，绝不触发重用检测。
 *
 * 代价：排队 tab 的原业务请求会挂起一个 refresh 周期（持锁 tab 释放后）才重放。
 *
 * 返回值：成功返回 expires_in（秒，供调度器重新 arm）；失败返回 null。
 *
 * SSR 或不支持 Web Locks：回退到纯单飞（无跨 tab 互斥）。
 */

let refreshing: Promise<number | null> | null = null;

const LOCK_NAME = "mimo-auth-refresh";

/**
 * triggerRefresh - 触发 refresh，单 tab 单飞 + 跨 tab queue 互斥
 *
 * @param doRefresh 实际执行 refresh 的函数；成功返回新 expires_in（秒），失败返回 null
 * @returns expires_in（成功）/ null（失败，需弹登录）
 */
export const triggerRefresh = (doRefresh: () => Promise<number | null>): Promise<number | null> => {
    // 单 tab 单飞：并发调用共享同一 promise
    if (refreshing) return refreshing;

    refreshing = doRefreshWithLock(doRefresh).finally(() => {
        refreshing = null;
    });
    return refreshing;
};

// 测试用：重置模块级单飞状态，避免用例间泄漏
export function __resetForTest(): void {
    refreshing = null;
}

/**
 * doRefreshWithLock - 用 Web Locks 跨 tab 互斥 refresh
 *
 * queue 模式（不传 ifAvailable）：锁被其他 tab 持有时本请求排队，等持锁 tab
 * 释放后拿锁执行 doRefresh。保证拿锁时 cookie 已被前一个 tab 刷新，用新 token
 * 调 doRefresh，避免旧 token 触发 RotateReused。
 */
async function doRefreshWithLock(doRefresh: () => Promise<number | null>): Promise<number | null> {
    // 不支持 Web Locks：回退到无互斥单飞
    if (typeof navigator === "undefined" || !navigator.locks?.request) {
        return doRefresh();
    }

    // queue 模式：锁被占时排队，回调总拿到 lock（非 null）
    return navigator.locks.request(LOCK_NAME, async () => doRefresh());
}
