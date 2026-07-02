/**
 * 401 并发 refresh 队列 + 跨 tab 互斥
 *
 * 单 tab 内：多个并发 401 共享同一个 promise（单飞），避免 cookie 互踩。
 * 跨 tab：navigator.locks.request 互斥串行化，同一浏览器同一 origin 同一时刻只有
 * 一个 tab 执行 refresh；排队 tab 拿到锁后【跳过 refresh】，直接返回成功哨兵，
 * 让原请求用新 cookie 重放。
 *
 * 为何排队 tab 不能再 refresh：旧 refresh token 已被持锁 tab 轮换，再用会触发后端
 * RotateReused → 整个家族吊销（见 ADR-0001 不变量 2），导致所有 tab 被强制登出。
 * 排队 tab 跳过 refresh 是安全的：cookie 跨 tab 共享，持锁 tab 成功后新 cookie 已就位，
 * 重放原请求即可；若持锁 tab 失败（cookie 未更新），重放会再 401，进入下一轮 triggerRefresh
 * （此时 refreshedThisRound 已被 finally 复位为 false，可正常执行真正的 refresh）。
 *
 * 返回值：成功返回 expires_in（秒，供调度器重新 arm）；失败返回 null。
 * 排队 tab 返回哨兵 REFRESH_SKIP（小正数）：触发原请求重放 + 短定时器。
 *
 * SSR 或不支持 Web Locks：回退到纯单飞（无跨 tab 互斥）。
 */

let refreshing: Promise<number | null> | null = null;

const LOCK_NAME = "mimo-auth-refresh";
// 排队 tab 跳过 refresh 时的成功哨兵：truthy 触发原请求重放，小值让定时器很快重新 arm。
const REFRESH_SKIP = 1;

/**
 * triggerRefresh - 触发 refresh，单 tab 单飞 + 跨 tab 互斥
 *
 * @param doRefresh 实际执行 refresh 的函数；成功返回新 expires_in（秒），失败返回 null
 * @returns expires_in（成功）/ null（失败，需弹登录）
 */
export const triggerRefresh = (doRefresh: () => Promise<number | null>): Promise<number | null> => {
    // 单 tab 单飞：并发调用共享同一 promise
    if (refreshing) return refreshing;

    refreshing = doRefreshWithLock(doRefresh).finally(() => {
        refreshing = null;
        // 一个完整的 401 处理周期结束：复位标志，允许下一轮真正 refresh。
        // 下一轮若是持锁失败后的重试，refreshedThisRound 为 false，可正常执行。
        refreshedThisRound = false;
    });
    return refreshing;
};

// 测试用：重置模块级状态，避免用例间泄漏
export function __resetForTest(): void {
    refreshing = null;
    refreshedThisRound = false;
}

// 本轮（本次 triggerRefresh 周期）是否已有持锁 tab 成功刷新过。
// 持锁成功置 true → 同周期内排队 tab 拿到锁后据此跳过；周期结束 finally 复位。
let refreshedThisRound = false;

/**
 * doRefreshWithLock - 用 Web Locks 互斥串行化跨 tab refresh
 */
async function doRefreshWithLock(doRefresh: () => Promise<number | null>): Promise<number | null> {
    // 不支持 Web Locks：回退到无互斥单飞
    if (typeof navigator === "undefined" || !navigator.locks?.request) {
        return doRefresh();
    }

    return navigator.locks.request(LOCK_NAME, async () => {
        if (refreshedThisRound) {
            // 本轮已有持锁 tab 刷新过，cookie 已更新；跳过，让原请求重放。
            // 绝不能再 refresh：旧 token 已被轮换，再用会触发家族吊销。
            return REFRESH_SKIP;
        }
        // 持锁执行真正的 refresh
        const result = await doRefresh();
        if (result !== null) {
            refreshedThisRound = true; // 标记本轮已刷新，后续排队 tab 据此跳过
        }
        return result;
    });
}
