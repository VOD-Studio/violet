import { webcrypto } from "node:crypto";
import { useChunkedUpload } from "@features/upload/hooks/use-chunked-upload";
import { deferred } from "@features/upload/lib/__tests__/deferred";
import { httpClient } from "@shared/api/http";
import { cleanup, renderHook } from "@testing-library/react";
import { AxiosError, CanceledError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalAdapter = httpClient.defaults.adapter;
const success = (config: InternalAxiosRequestConfig, data: unknown) => ({
	config,
	data: { data },
	status: 200,
	statusText: "OK",
	headers: {},
});

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => {
	cleanup();
	httpClient.defaults.adapter = originalAdapter;
	vi.unstubAllGlobals();
});

describe("真实分片请求编排", () => {
	it("单项恢复采用服务端分片大小并跳过已上传分片", async () => {
		let uploadId = "";
		const chunks: { index: number; size: number }[] = [];
		let failed = false;
		let completeCount = 0;
		httpClient.defaults.adapter = async (config) => {
			if (config.url === "/uploads") {
				const body = JSON.parse(config.data);
				uploadId = body.clientUploadId;
				return success(config, {
					instant: false,
					upload_id: body.clientUploadId,
					chunk_size: 2,
					total_chunks: 3,
					uploaded_chunks: failed ? [0, 1] : [0],
				});
			}
			if (config.method === "get" && config.url === `/uploads/${uploadId}`) {
				return success(config, {
					instant: false,
					upload_id: uploadId,
					chunk_size: 2,
					total_chunks: 3,
					uploaded_chunks: [0, 1],
				});
			}
			if (config.url?.includes("/chunks/")) {
				const index = Number(config.url.split("/").at(-1));
				chunks.push({ index, size: config.data.byteLength });
				if (index === 2 && !failed) {
					failed = true;
					throw new AxiosError(
						"限流",
						"ERR_BAD_REQUEST",
						config,
						{},
						{
							config,
							status: 429,
							statusText: "限流",
							headers: { "retry-after": "1" },
							data: { error: "RATE_LIMITED", message: "等待" },
						},
					);
				}
				return success(config, null);
			}
			if (config.url?.endsWith("/complete")) {
				completeCount++;
				return success(config, { file_id: "file", url: "/file.png" });
			}
			throw new Error(`非预期请求 ${config.url}`);
		};
		const { result } = renderHook(() => useChunkedUpload());
		const source = new File(["abcde"], "source.png", { type: "image/png" });
		await expect(result.current.uploadFile(source)).rejects.toMatchObject({ status: 429 });
		const progress = vi.fn();
		await expect(result.current.uploadFile(source, progress)).resolves.toMatchObject({
			file_id: "file",
		});
		expect(chunks).toEqual([
			{ index: 1, size: 2 },
			{ index: 2, size: 1 },
			{ index: 2, size: 1 },
		]);
		expect(progress).toHaveBeenCalledWith({ uploaded: 4, total: 5, percent: 80 });
		expect(completeCount).toBe(1);
	});

	it("每窗口只有一个写额度时，恢复仍能依次完成分片和合并", async () => {
		let remainingWrites = 0;
		let uploadId = "";
		const chunks = new Map<number, string>();
		const status = () => ({
			instant: false,
			upload_id: uploadId,
			chunk_size: 2,
			total_chunks: 3,
			uploaded_chunks: [...chunks.keys()],
		});
		httpClient.defaults.adapter = async (config) => {
			if (config.method === "get") return success(config, status());
			if (remainingWrites === 0) {
				throw new AxiosError(
					"限流",
					"ERR_BAD_REQUEST",
					config,
					{},
					{
						config,
						status: 429,
						statusText: "Too Many Requests",
						headers: { "retry-after": "1" },
						data: { error: "RATE_LIMITED", message: "等待下一窗口" },
					},
				);
			}
			remainingWrites--;
			if (config.url === "/uploads") {
				uploadId = JSON.parse(config.data).clientUploadId;
				return success(config, status());
			}
			if (config.url?.includes("/chunks/")) {
				const index = Number(config.url.split("/").at(-1));
				chunks.set(index, new TextDecoder().decode(config.data));
				return success(config, null);
			}
			if (config.url?.endsWith("/complete") && chunks.size === 3) {
				return success(config, { file_id: "completed", url: "/complete.txt" });
			}
			throw new Error(`非预期请求 ${config.url}`);
		};
		const { result } = renderHook(() => useChunkedUpload());
		const source = new File(["abcde"], "source.txt");
		let completed: unknown;
		for (let window = 0; window < 5; window++) {
			remainingWrites = 1;
			completed = await result.current.uploadFile(source).catch((error: unknown) => {
				expect(error).toMatchObject({ status: 429 });
				return undefined;
			});
		}
		expect(completed).toMatchObject({ file_id: "completed" });
		expect(
			[...chunks.entries()]
				.sort(([a], [b]) => a - b)
				.map(([, data]) => data)
				.join(""),
		).toBe("abcde");
	});

	it.each([
		false,
		true,
	])("取消初始化丢失响应时仍清理稳定ID，已合并=%s按真实结果返回", async (completed) => {
		const started = deferred<void>();
		let token = "";
		let cancelURL = "";
		httpClient.defaults.adapter = async (config) => {
			if (config.method === "delete") {
				cancelURL = config.url ?? "";
				expect(config.signal).toBeUndefined();
				return success(
					config,
					completed
						? { completed: true, file: { file_id: "merged", url: "/merged.png" } }
						: { completed: false },
				);
			}
			token = JSON.parse(config.data).clientUploadId;
			const response = deferred<never>();
			config.signal?.addEventListener?.(
				"abort",
				() => response.reject(new CanceledError("取消", config)),
				{ once: true },
			);
			started.resolve();
			return response.promise;
		};
		const { result } = renderHook(() => useChunkedUpload());
		const controller = new AbortController();
		const upload = result.current.uploadFile(
			new File(["abc"], "source.png"),
			undefined,
			controller.signal,
		);
		const assertion = completed
			? expect(upload).resolves.toMatchObject({ file_id: "merged" })
			: expect(upload).rejects.toMatchObject({ name: "AbortError" });
		await started.promise;
		controller.abort();
		await assertion;
		expect(cancelURL).toBe(`/uploads/${token}`);
	});

	it("哈希读取前取消不发起网络写入", async () => {
		const adapter = vi.fn();
		httpClient.defaults.adapter = adapter;
		const { result } = renderHook(() => useChunkedUpload());
		const controller = new AbortController();
		controller.abort();
		await expect(
			result.current.uploadFile(
				new File(["abc"], "source.png"),
				undefined,
				controller.signal,
			),
		).rejects.toMatchObject({ name: "AbortError" });
		expect(adapter).not.toHaveBeenCalled();
	});
});
