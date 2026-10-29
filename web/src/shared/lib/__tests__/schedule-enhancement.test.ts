import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEnhancementScheduler, scheduleEnhancement } from "../schedule-enhancement";

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(async () => {
	await vi.runAllTimersAsync();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

function host(top: number) {
	const element = document.createElement("div");
	vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(0, top, 100, 100));
	return element;
}

describe("scheduleEnhancement", () => {
	it("可见块先执行，并在两个重任务之间让出事件循环", async () => {
		// 验证平台事件循环排序；假时钟会改变定时器与微任务内零延时任务的先后关系。
		vi.useRealTimers();
		try {
			const events: string[] = [];
			const input = Promise.withResolvers<void>();
			const distant = scheduleEnhancement(() => events.push("near"), {
				element: host(5000),
			});
			const visible = scheduleEnhancement(
				() => {
					events.push("visible");
					setTimeout(() => {
						events.push("input");
						input.resolve();
					}, 0);
				},
				{ element: host(20) },
			);
			expect(events).toEqual([]);
			await Promise.all([distant, visible, input.promise]);
			expect(events).toEqual(["visible", "input", "near"]);
		} finally {
			vi.useFakeTimers();
		}
	});

	it("等待期间取消不执行计算，剩余任务仍可完成", async () => {
		const controller = new AbortController();
		const work = vi.fn();
		const cancelled = scheduleEnhancement(work, { signal: controller.signal });
		const rejection = expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
		controller.abort();
		const next = scheduleEnhancement(() => "done");
		await vi.runAllTimersAsync();
		await rejection;
		expect(work).not.toHaveBeenCalled();
		await expect(next).resolves.toBe("done");
	});

	it("局部任务失败不会阻塞后续块", async () => {
		const failed = scheduleEnhancement(() => {
			throw new Error("bad diagram");
		});
		const rejection = expect(failed).rejects.toThrow("bad diagram");
		const next = scheduleEnhancement(() => "readable");
		await vi.runAllTimersAsync();
		await rejection;
		await expect(next).resolves.toBe("readable");
	});

	it("已启动的异步计算完成前不交叉执行下一块", async () => {
		const completion = Promise.withResolvers<void>();
		const events: string[] = [];
		const first = scheduleEnhancement(() => {
			events.push("start");
			return completion.promise;
		});
		const second = scheduleEnhancement(() => events.push("next"));
		await vi.advanceTimersByTimeAsync(0);
		expect(events).toEqual(["start"]);
		completion.resolve();
		await first;
		await vi.runAllTimersAsync();
		await second;
		expect(events).toEqual(["start", "next"]);
	});

	it("独立实例等待异步资源时不占用共享队列，取消不提前释放自身串行约束", async () => {
		const scheduleResource = createEnhancementScheduler();
		const controller = new AbortController();
		const events: string[] = [];
		const { promise, resolve } = Promise.withResolvers<void>();
		const waiting = scheduleResource(
			() => {
				events.push("resource:start");
				return promise;
			},
			{ signal: controller.signal },
		);
		const cancelled = expect(waiting).rejects.toMatchObject({ name: "AbortError" });
		const next = scheduleResource(() => events.push("resource:next"));
		try {
			await vi.runAllTimersAsync();
			controller.abort();
			const shared = scheduleEnhancement(() => events.push("shared:complete"));
			await vi.runAllTimersAsync();
			await cancelled;
			expect(events).toEqual(["resource:start", "shared:complete"]);
			await shared;
		} finally {
			resolve();
			await vi.runAllTimersAsync();
			await next;
		}
		expect(events).toEqual(["resource:start", "shared:complete", "resource:next"]);
	});
});
