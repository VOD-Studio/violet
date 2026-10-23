import { deferred as createDeferred } from "@features/upload/lib/__tests__/deferred";
import { Uploader } from "@features/upload/ui/Uploader";
import { httpClient } from "@shared/api/http";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ useBlocker: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const originalAdapter = httpClient.defaults.adapter;
afterEach(() => {
	cleanup();
	httpClient.defaults.adapter = originalAdapter;
});

describe("Uploader多文件交互", () => {
	it("多批次仍受配置并发约束，允许取消排队项并逐项成功通知", async () => {
		httpClient.defaults.adapter = async (config) => {
			if (config.url !== "/uploads/policy") throw new Error(`非预期请求 ${config.url}`);
			return {
				config,
				status: 200,
				statusText: "OK",
				headers: {},
				data: { data: { version: 1, max_concurrent_files: 1 } },
			};
		};
		const pending = createDeferred<{ url: string }>();
		const upload = vi.fn(async () => pending.promise);
		const onUploaded = vi.fn();
		const onBusyChange = vi.fn();
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const { container } = render(
			<QueryClientProvider client={client}>
				<Uploader upload={upload} onUploaded={onUploaded} onBusyChange={onBusyChange} />
			</QueryClientProvider>,
		);
		const input = container.querySelector("input");
		if (!input) throw new Error("缺少文件选择入口");
		const first = new File(["a"], "a.png", { type: "image/png" });
		fireEvent.change(input, { target: { files: [first] } });
		fireEvent.change(input, {
			target: { files: [new File(["b"], "b.png", { type: "image/png" })] },
		});
		await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
		expect(screen.getByText("排队中")).toBeTruthy();
		const cancelButtons = screen.getAllByRole("button", { name: "取消" });
		fireEvent.click(cancelButtons[1]);
		expect(screen.getByText("已取消")).toBeTruthy();
		await act(async () => pending.resolve({ url: "/a.png" }));
		await waitFor(() => expect(screen.getByText("已完成 1 个")).toBeTruthy());
		expect(onUploaded).toHaveBeenCalledExactlyOnceWith({ url: "/a.png" }, first);
		expect(upload).toHaveBeenCalledTimes(1);
		expect(onBusyChange).toHaveBeenLastCalledWith(false);
		client.clear();
	});

	it("正在上传项的取消透传AbortSignal并保留取消状态", async () => {
		httpClient.defaults.adapter = async (config) => ({
			config,
			status: 200,
			statusText: "OK",
			headers: {},
			data: { data: { version: 1, max_concurrent_files: 1 } },
		});
		let signal: AbortSignal | undefined;
		const upload = async (
			_file: File,
			_progress?: (percent: number) => void,
			abort?: AbortSignal,
		) => {
			signal = abort;
			const deferred = createDeferred<{ url: string }>();
			abort?.addEventListener(
				"abort",
				() => deferred.reject(new DOMException("取消", "AbortError")),
				{ once: true },
			);
			return deferred.promise;
		};
		const client = new QueryClient();
		const onUploaded = vi.fn();
		const { container } = render(
			<QueryClientProvider client={client}>
				<Uploader upload={upload} onUploaded={onUploaded} />
			</QueryClientProvider>,
		);
		const input = container.querySelector("input");
		if (!input) throw new Error("缺少文件选择入口");
		fireEvent.change(input, {
			target: { files: [new File(["a"], "a.png", { type: "image/png" })] },
		});
		await waitFor(() => expect(signal).toBeDefined());
		fireEvent.click(screen.getByRole("button", { name: "取消" }));
		await waitFor(() => expect(screen.getByText("已取消")).toBeTruthy());
		expect(signal?.aborted).toBe(true);
		expect(onUploaded).not.toHaveBeenCalled();
		client.clear();
	});
});
