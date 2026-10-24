import { describe, expect, it, vi } from "vitest";
import { createAsyncLoader } from "../create-async-loader";

describe("createAsyncLoader", () => {
	it("按需执行工厂，并发与完成后的调用共享同一个结果", async () => {
		let complete: ((value: object) => void) | undefined;
		const factory = vi.fn(
			() =>
				new Promise<object>((resolve) => {
					complete = resolve;
				}),
		);
		const load = createAsyncLoader(factory);
		expect(factory).not.toHaveBeenCalled();
		const first = load();
		expect(load()).toBe(first);
		const resource = { ready: true };
		complete?.(resource);
		expect(await first).toBe(resource);
		expect(load()).toBe(first);
		expect(factory).toHaveBeenCalledTimes(1);
	});

	it("失败原样返回且不自动重试，后续调用可以重新初始化", async () => {
		const failure = new Error("模块下载失败");
		const resource = { ready: true };
		const factory = vi
			.fn<() => Promise<typeof resource>>()
			.mockRejectedValueOnce(failure)
			.mockResolvedValueOnce(resource);
		const load = createAsyncLoader(factory);
		const first = load();
		expect(load()).toBe(first);
		await expect(first).rejects.toBe(failure);
		expect(factory).toHaveBeenCalledTimes(1);
		const retry = load();
		expect(retry).not.toBe(first);
		expect(await retry).toBe(resource);
		expect(load()).toBe(retry);
		expect(factory).toHaveBeenCalledTimes(2);
	});

	it("工厂同步异常不留下失败缓存", async () => {
		const failure = new Error("初始化失败");
		const factory = vi
			.fn<() => Promise<number>>()
			.mockImplementationOnce(() => {
				throw failure;
			})
			.mockResolvedValueOnce(42);
		const load = createAsyncLoader(factory);
		expect(load).toThrow(failure);
		await expect(load()).resolves.toBe(42);
	});
});
