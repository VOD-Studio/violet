import { deferred as createDeferred } from "@features/upload/lib/__tests__/deferred";
import { UploadQueue } from "@features/upload/lib/upload-queue";
import { ApiError } from "@shared/api/error";
import { afterEach, describe, expect, it, vi } from "vitest";

const file = (name: string) => new File([name], name, { type: "image/png" });
const drain = async () => {
	for (let i = 0; i < 8; i++) await Promise.resolve();
};

afterEach(() => vi.useRealTimers());

describe("跨批次上传调度", () => {
	it("两次选择共用并发上限，降低配置不终止在途文件", async () => {
		const queue = new UploadQueue<string>();
		const pending = new Map<string, ReturnType<typeof createDeferred<string>>>();
		let active = 0;
		let peak = 0;
		const run = async (source: File) => {
			active++;
			peak = Math.max(peak, active);
			const deferred = createDeferred<string>();
			pending.set(source.name, deferred);
			try {
				return await deferred.promise;
			} finally {
				active--;
			}
		};
		const completed = vi.fn();
		queue.setConcurrency(2);
		queue.add([file("a"), file("b")], run, completed);
		queue.add([file("c"), file("d")], run, completed);
		expect(active).toBe(2);
		expect(queue.getSnapshot().map((item) => item.status)).toEqual([
			"uploading",
			"uploading",
			"queued",
			"queued",
		]);
		queue.setConcurrency(1);
		pending.get("a")?.resolve("a");
		await drain();
		expect(pending.has("c")).toBe(false);
		pending.get("b")?.resolve("b");
		await drain();
		expect(pending.has("c")).toBe(true);
		pending.get("c")?.resolve("c");
		await drain();
		pending.get("d")?.resolve("d");
		await drain();
		expect(peak).toBe(2);
		expect(completed).toHaveBeenCalledTimes(4);
		queue.dispose();
	});

	it("429按真实恢复时刻暂停后续调度，单项恢复不重复完成统计", async () => {
		vi.useFakeTimers();
		const queue = new UploadQueue<string>();
		queue.setConcurrency(1);
		const completed = vi.fn();
		const run = vi
			.fn<(_: File) => Promise<string>>()
			.mockRejectedValueOnce(
				new ApiError({
					error: "RATE_LIMITED",
					message: "等待",
					status: 429,
					retryAt: Date.now() + 65_000,
				}),
			)
			.mockResolvedValue("完成");
		queue.add([file("a"), file("b")], run, completed);
		await drain();
		expect(queue.getSnapshot()[0]?.status).toBe("waiting");
		await vi.advanceTimersByTimeAsync(64_999);
		expect(run).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		await drain();
		expect(run).toHaveBeenCalledTimes(3);
		expect(completed).toHaveBeenCalledTimes(2);
		queue.retry(queue.getSnapshot()[0]?.id ?? "");
		await drain();
		expect(completed).toHaveBeenCalledTimes(2);
		queue.dispose();
	});

	it("连续五轮429均等待真实期限后续传，最终成功只通知一次", async () => {
		vi.useFakeTimers();
		const queue = new UploadQueue<string>();
		queue.setConcurrency(1);
		const completed = vi.fn();
		let attempts = 0;
		const run = vi.fn(async () => {
			attempts++;
			if (attempts <= 5) {
				throw new ApiError({
					error: "RATE_LIMITED",
					message: "等待",
					status: 429,
					retryAt: Date.now() + 1000,
				});
			}
			return "完成";
		});
		const source = file("a");
		queue.add([source], run, completed);
		await drain();
		const id = queue.getSnapshot()[0]?.id;
		for (let round = 0; round < 5; round++) {
			expect(queue.getSnapshot()[0]).toMatchObject({ id, status: "waiting" });
			expect(completed).not.toHaveBeenCalled();
			await vi.advanceTimersByTimeAsync(999);
			expect(run).toHaveBeenCalledTimes(round + 1);
			await vi.advanceTimersByTimeAsync(1);
			await drain();
		}
		expect(run).toHaveBeenCalledTimes(6);
		expect(queue.getSnapshot()).toHaveLength(1);
		expect(queue.getSnapshot()[0]).toMatchObject({ id, status: "done", result: "完成" });
		expect(completed).toHaveBeenCalledExactlyOnceWith("完成", source);
		await vi.advanceTimersByTimeAsync(10_000);
		expect(run).toHaveBeenCalledTimes(6);
		expect(completed).toHaveBeenCalledTimes(1);
		queue.dispose();
	});

	it("排队取消不执行文件，合并先完成的取消竞争仍报告真实成功", async () => {
		const queue = new UploadQueue<string>();
		queue.setConcurrency(1);
		const merged = createDeferred<string>();
		let signal: AbortSignal | undefined;
		const completed = vi.fn();
		const run = vi.fn(
			async (_file: File, _progress: (value: number) => void, input: AbortSignal) => {
				signal = input;
				return merged.promise;
			},
		);
		queue.add([file("a"), file("b")], run, completed);
		const [first, second] = queue.getSnapshot();
		queue.cancel(second?.id ?? "");
		queue.cancel(first?.id ?? "");
		expect(signal?.aborted).toBe(true);
		merged.resolve("服务端已经合并");
		await drain();
		expect(queue.getSnapshot().map((item) => item.status)).toEqual(["done", "cancelled"]);
		expect(run).toHaveBeenCalledTimes(1);
		expect(completed).toHaveBeenCalledTimes(1);
		queue.dispose();
	});

	it("取消等待中的上传仍执行服务端清理，清理失败不能显示已取消", async () => {
		const queue = new UploadQueue<string>();
		queue.setConcurrency(1);
		let cleanups = 0;
		const run = async (
			_source: File,
			_progress: (value: number) => void,
			signal: AbortSignal,
		) => {
			if (signal.aborted) {
				cleanups++;
				throw new Error("取消接口不可用");
			}
			throw new ApiError({
				error: "RATE_LIMITED",
				message: "等待",
				status: 429,
				retryAt: Date.now() + 1000,
			});
		};
		queue.add([file("a")], run, vi.fn());
		await drain();
		queue.cancel(queue.getSnapshot()[0]?.id ?? "");
		await drain();
		expect(cleanups).toBe(1);
		expect(queue.getSnapshot()[0]).toMatchObject({
			status: "error",
			error: "取消尚未确认：取消接口不可用",
		});
	});
});
