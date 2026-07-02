import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetForTest, triggerRefresh } from "../refresh-queue";

/**
 * refresh-queue 单测：验证单 tab 单飞 + 跨 tab 互斥（ifAvailable 语义）。
 *
 * navigator.locks.request 用桩模拟：
 * - 锁可用时回调收到 truthy lock，执行真正逻辑；
 * - 锁被占用时（模拟其他 tab 持锁）回调收到 null，跳过。
 */
describe("triggerRefresh", () => {
    // 模拟锁是否被占用：测试可设为 true 模拟"另一 tab 正持锁"
    let lockHeldByOther = false;

    beforeEach(() => {
        __resetForTest();
        lockHeldByOther = false;
        vi.stubGlobal("navigator", {
            locks: {
                request: async (
                    _name: string,
                    _options: { ifAvailable?: boolean },
                    cb: (lock: { name: string } | null) => Promise<unknown>,
                ) => {
                    // ifAvailable 语义：锁被占用 → 回调收 null；否则收假 lock 对象
                    const lock = lockHeldByOther ? null : { name: _name };
                    return cb(lock);
                },
            },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

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

    it("锁被其他 tab 持有时跳过 doRefresh 返回哨兵", async () => {
        // 模拟另一 tab 正持锁：本 tab 的 ifAvailable 请求拿到 null
        lockHeldByOther = true;
        const doRefresh = vi.fn(async () => 900);

        const res = await triggerRefresh(doRefresh);

        // 跳过 doRefresh，返回 truthy 哨兵（让原请求重放）
        expect(doRefresh).not.toHaveBeenCalled();
        expect(res).toBe(1);
    });
});
