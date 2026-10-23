import { ApiError, parseRetryAt } from "@shared/api/error";
import { createHttpClient } from "@shared/api/http";
import { AxiosError, CanceledError, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";

describe("服务端恢复期限", () => {
	it("解析秒数与HTTP日期，并依据服务端时钟修正", () => {
		const now = Date.parse("2026-10-22T00:00:00Z");
		expect(parseRetryAt("65", now)).toBe(now + 65_000);
		expect(
			parseRetryAt("Thu, 22 Oct 2026 01:02:00 GMT", now, "Thu, 22 Oct 2026 01:00:00 GMT"),
		).toBe(now + 120_000);
		expect(parseRetryAt(undefined, now)).toBeUndefined();
		expect(parseRetryAt("无效", now)).toBeUndefined();
	});

	it("429保留响应头与恢复时刻，写请求不会由传输层重试", async () => {
		const client = createHttpClient();
		const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
			throw new AxiosError(
				"请求受限",
				"ERR_BAD_REQUEST",
				config,
				{},
				{
					status: 429,
					statusText: "Too Many Requests",
					config,
					headers: { "retry-after": "65" },
					data: { error: "RATE_LIMITED", message: "等待" },
				},
			);
		});
		client.defaults.adapter = adapter;
		const before = Date.now();
		let caught: unknown;
		try {
			await client.post("/uploads", {});
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(ApiError);
		if (!(caught instanceof ApiError)) throw new Error("未返回ApiError");
		expect(caught.retryAfter).toBe("65");
		expect(caught.retryAt).toBeGreaterThanOrEqual(before + 65_000);
		expect(adapter).toHaveBeenCalledTimes(1);
	});

	it("取消信号不转换为未知业务错误或重试", async () => {
		const client = createHttpClient();
		const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
			throw new CanceledError("已取消", config);
		});
		client.defaults.adapter = adapter;
		await expect(client.post("/uploads", {})).rejects.toBeInstanceOf(CanceledError);
		expect(adapter).toHaveBeenCalledTimes(1);
	});
});
