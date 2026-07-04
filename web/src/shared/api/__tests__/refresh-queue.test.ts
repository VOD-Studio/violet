import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetForTest, triggerRefresh } from "../refresh-queue";

/**
 * refresh-queue 单测：验证单 tab 单飞 + 跨 tab 排队（queue 语义）。
 *
 * navigator.locks.request 用桩模拟，按 options.ifAvailable 忠实区分两种语义：
 * - ifAvailable:true 且锁被占 → 回调立即收 null（当前旧行为）
 * - 否则（queue 模式）锁被占 → 回调挂起，等 releaseLock() 后才拿 lock 执行
 *
 * 第 5 个用例断言「queue 模式」契约：triggerRefresh 不传 ifAvailable，
 * 锁被占时排队，等锁释放后用更新后的 cookie 执行 doRefresh。
 */

/** 排队请求的释放控制器 */
let releaseLock: (() => void) | null = null;

/** 当前锁是否被占 */
let lockHeld = false;

beforeEach(() => {
    __resetForTest();
    lockHeld = false;
    releaseLock = null;
    vi.stubGlobal("navigator", {
        locks: {
            request: (name: string, ...rest: unknown[]): Promise<unknown> => {
                // 兼容两种重载：request(name, cb) 和 request(name, options, cb)
                const options =
                    typeof rest[0] === "object" && rest[0] !== null
                        ? (rest[0] as { ifAvailable?: boolean })
                        : undefined;
                const cb = (
                    typeof rest[0] === "object" && rest[0] !== null ? rest[1] : rest[0]
                ) as (lock: { name: string } | null) => Promise<unknown>;

                // 锁可用 → 立即持锁执行；执行完释放锁
                if (!lockHeld) {
                    lockHeld = true;
                    return Promise.resolve(cb({ name })).finally(() => {
                        lockHeld = false;
                    });
                }
                // 锁被占：
                // - ifAvailable:true → 立即回调 null（旧行为，调用方据此跳过）
                // - 否则（queue 模式）→ 挂起，等 releaseLock() 后持锁执行
                if (options?.ifAvailable) {
                    return Promise.resolve(cb(null));
                }
                return new Promise((resolve) => {
                    releaseLock = () => {
                        lockHeld = true;
                        resolve(
                            Promise.resolve(cb({ name })).finally(() => {
                                lockHeld = false;
                            }),
                        );
                    };
                });
            },
        },
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("triggerRefresh", () => {
    it("同 tab 并发调用只触发一次 doRefresh（单飞）", async () => {
        const doRefresh = vi.fn(async () => 900);

        const [a, b, c] = await Promise.all([
            triggerRefresh(doRefresh),
            triggerRefresh(doRefresh),
            triggerRefresh(doRefresh),
        ]);

        expect(doRefresh).toHaveBeenCalledTimes(1);
        expect(a).toBe(900);
        expect(b).toBe(900);
        expect(c).toBe(900);
    });

    it("doRefresh 失败返回 null", async () => {
        const doRefresh = vi.fn(async () => null);
        const res = await triggerRefresh(doRefresh);
        expect(res).toBeNull();
    });

    it("不支持 Web Locks 时回退到直接执行", async () => {
        vi.stubGlobal("navigator", {}); // 无 locks
        const doRefresh = vi.fn(async () => 600);
        const res = await triggerRefresh(doRefresh);
        expect(res).toBe(600);
        expect(doRefresh).toHaveBeenCalledTimes(1);
    });

    it("一个周期结束后可再次 refresh（单飞状态复位）", async () => {
        const doRefresh = vi.fn(async () => 900);
        await triggerRefresh(doRefresh);
        const res = await triggerRefresh(doRefresh);
        expect(doRefresh).toHaveBeenCalledTimes(2);
        expect(res).toBe(900);
    });

    it("锁被其他 tab 持有时：排队等锁释放后才执行 doRefresh（不跳过、不传 ifAvailable）", async () => {
        // 监视 locks.request 的调用参数，确认 queue 模式（不传 ifAvailable）
        const requestSpy = vi.spyOn(navigator.locks, "request");

        // 模拟另一 tab 已持锁：本 tab 请求会被挂起（queue）或立即跳过（ifAvailable）
        lockHeld = true;
        const doRefresh = vi.fn(async () => 900);

        const promise = triggerRefresh(doRefresh);
        // 排队期间 doRefresh 尚未执行
        expect(doRefresh).not.toHaveBeenCalled();

        // 释放锁（模拟另一 tab 刷新完成）：排队者拿到锁后执行 doRefresh
        releaseLock?.();
        const res = await promise;

        // queue 语义：后来者最终执行了 doRefresh（用更新后的 cookie），不返回跳过哨兵
        expect(doRefresh).toHaveBeenCalledTimes(1);
        expect(res).toBe(900);
        // 确认 triggerRefresh 用 queue 模式调用 locks.request：不传 ifAvailable:true
        // queue 模式调用为 request(name, cb)，options 缺失或不含 ifAvailable:true
        const callArgs = requestSpy.mock.calls[0] ?? [];
        const optArg = callArgs.find(
            (a) => typeof a === "object" && a !== null && "ifAvailable" in (a as object),
        ) as { ifAvailable?: boolean } | undefined;
        expect(optArg?.ifAvailable).not.toBe(true);
    });
});
