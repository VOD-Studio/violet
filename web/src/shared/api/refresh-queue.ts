/**
 * 401 并发 refresh 队列 + 跨 tab 互斥
 *
 * 单 tab 内：多个并发 401 共享同一个 promise（单飞），避免 cookie 互踩。
 * 跨 tab：navigator.locks.request 配合 ifAvailable:true，锁被占用时回调收到 null，
 * 该 tab 直接跳过 refresh。这样同一浏览器同一 origin 同一时刻只有一个 tab 真正 refresh。
 *
 * 为何其他 tab 跳过是安全的：cookie 跨同源 tab 共享，持锁 tab 成功后新 cookie 立即对所有
 * tab 可见，跳过 tab 的原请求重放会自动带上新 cookie；若持锁 tab 失败（cookie 未更新），
 * 跳过 tab 重放会再 401，进入下一轮（锁已释放，它可成为新持锁者）。
 * 绝不能再 refresh：旧 refresh token 已被持锁 tab 轮换，再用会触发后端 RotateReused →
 * 整个家族吊销（见 ADR-0001 不变量 2）。
 *
 * 返回值：成功返回 expires_in（秒，供调度器重新 arm）；失败返回 null。
 * 跳过 tab 返回 REFRESH_SKIP（truthy 哨兵）触发原请求重放。
 *
 * SSR 或不支持 Web Locks：回退到纯单飞（无跨 tab 互斥）。
 */

let refreshing: Promise<number | null> | null = null;

const LOCK_NAME = "mimo-auth-refresh";
// 跳过 refresh 时的成功哨兵：truthy 触发原请求重放，小值让定时器很快重新 arm
// （跳过 tab 不知真实 expires_in；重放成功后响应不会触发新 refresh，定时器值无关紧要）。
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
 * ifAvailable:true —— 锁可用则持锁执行 doRefresh；锁被其他 tab 持有则回调收到 null，
 * 跳过 refresh 返回哨兵。互斥语义保证同一时刻只有一个 tab 真正执行 doRefresh。
 */
async function doRefreshWithLock(doRefresh: () => Promise<number | null>): Promise<number | null> {
    // 不支持 Web Locks：回退到无互斥单飞
    if (typeof navigator === "undefined" || !navigator.locks?.request) {
        return doRefresh();
    }

    return navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (!lock) {
            // 锁被其他 tab 持有：跳过 refresh，让原请求重放（用持锁 tab 写入的新 cookie）
            return REFRESH_SKIP;
        }
        // 持锁执行真正的 refresh；回调 resolve 时锁自动释放
        return doRefresh();
    });
}
