import { deferred as createDeferred } from "@features/upload/lib/__tests__/deferred";
import { Uploader, type UploaderProps } from "@features/upload/ui/Uploader";
import { ApiError } from "@shared/api/error";
import { httpClient } from "@shared/api/http";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ useBlocker: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const originalAdapter = httpClient.defaults.adapter;
const originalCreateURL = URL.createObjectURL;
const originalRevokeURL = URL.revokeObjectURL;
const clients = new Set<QueryClient>();

beforeEach(() => {
	let nextURL = 0;
	URL.createObjectURL = vi.fn(() => `blob:preview-${++nextURL}`);
	URL.revokeObjectURL = vi.fn();
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
});

afterEach(() => {
	cleanup();
	for (const client of clients) client.clear();
	clients.clear();
	httpClient.defaults.adapter = originalAdapter;
	URL.createObjectURL = originalCreateURL;
	URL.revokeObjectURL = originalRevokeURL;
	vi.restoreAllMocks();
});

function renderUploader(props: UploaderProps<{ url: string; thumbnail?: string }>) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	clients.add(client);
	return render(
		<QueryClientProvider client={client}>
			<Uploader {...props} />
		</QueryClientProvider>,
	);
}

function uploadRow(name: string) {
	const row = screen.getByTitle(name).closest<HTMLElement>(".v-upload-queue__row");
	if (!row) throw new Error(`缺少文件行 ${name}`);
	return row;
}

function selectFiles(container: HTMLElement, files: File[]) {
	const input = container.querySelector("input[type=file]");
	if (!input) throw new Error("缺少文件选择入口");
	fireEvent.change(input, { target: { files } });
}

const file = (name: string) => new File([name], name, { type: "image/png" });

describe("Uploader多文件交互", () => {
	it("多批次共用并发约束，排队取消不执行文件且成功逐项通知", async () => {
		const pending = createDeferred<{ url: string }>();
		const upload = vi.fn(async () => pending.promise);
		const onUploaded = vi.fn();
		const onBusyChange = vi.fn();
		const { container, unmount } = renderUploader({ upload, onUploaded, onBusyChange });
		const first = file("a.png");
		selectFiles(container, [first]);
		selectFiles(container, [file("b.png")]);
		await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
		expect(uploadRow("b.png").dataset.state).toBe("queued");
		expect(uploadRow("a.png").querySelector("img")?.getAttribute("src")).toBe("blob:preview-1");
		fireEvent.click(within(uploadRow("b.png")).getByRole("button", { name: /取消/ }));
		expect(uploadRow("b.png").dataset.state).toBe("cancelled");
		expect(URL.revokeObjectURL).not.toHaveBeenCalled();
		await act(async () => pending.resolve({ url: "/a.png" }));
		await waitFor(() => expect(uploadRow("a.png").dataset.state).toBe("done"));
		expect(onUploaded).toHaveBeenCalledExactlyOnceWith({ url: "/a.png" }, first);
		expect(upload).toHaveBeenCalledTimes(1);
		expect(onBusyChange).toHaveBeenLastCalledWith(false);
		expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:preview-1");
		fireEvent.click(within(uploadRow("b.png")).getByRole("button", { name: /移除/ }));
		await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2));
		unmount();
		expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
	});

	it("正在上传项透传AbortSignal，确认返回前不伪装已取消", async () => {
		const pending = createDeferred<{ url: string }>();
		let signal: AbortSignal | undefined;
		const upload = async (
			_file: File,
			_progress?: (percent: number) => void,
			abort?: AbortSignal,
		) => {
			signal = abort;
			return pending.promise;
		};
		const onUploaded = vi.fn();
		const { container } = renderUploader({ upload, onUploaded });
		selectFiles(container, [file("a.png")]);
		await waitFor(() => expect(signal).toBeDefined());
		fireEvent.click(within(uploadRow("a.png")).getByRole("button", { name: /取消/ }));
		expect(signal?.aborted).toBe(true);
		expect(uploadRow("a.png").dataset.state).toBe("uploading");
		await act(async () => pending.reject(new DOMException("取消", "AbortError")));
		await waitFor(() => expect(uploadRow("a.png").dataset.state).toBe("cancelled"));
		expect(onUploaded).not.toHaveBeenCalled();
	});

	it("关闭须确认且等待取消结果，合并先完成仍交付成功后再移除队列", async () => {
		const pending = createDeferred<{ url: string }>();
		let signal: AbortSignal | undefined;
		const upload = vi.fn(
			async (_file: File, _progress?: (percent: number) => void, abort?: AbortSignal) => {
				signal = abort;
				return pending.promise;
			},
		);
		const onUploaded = vi.fn();
		const onBatchUploaded = vi.fn();
		const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
		const { container } = renderUploader({ upload, onUploaded, onBatchUploaded });
		const first = file("a.png");
		selectFiles(container, [first, file("b.png")]);
		await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
		fireEvent.click(screen.getByRole("button", { name: /关闭/ }));
		expect(confirm).toHaveBeenCalledTimes(1);
		expect(signal?.aborted).toBe(false);
		confirm.mockReturnValue(true);
		fireEvent.click(screen.getByRole("button", { name: /关闭/ }));
		expect(signal?.aborted).toBe(true);
		expect(uploadRow("a.png").dataset.state).toBe("uploading");
		expect(uploadRow("b.png").dataset.state).toBe("cancelled");
		await act(async () => pending.resolve({ url: "/a.png" }));
		await waitFor(() => expect(document.querySelector(".v-upload-queue")).toBeNull());
		expect(onUploaded).toHaveBeenCalledExactlyOnceWith({ url: "/a.png" }, first);
		expect(onBatchUploaded).toHaveBeenCalledExactlyOnceWith([
			{ result: { url: "/a.png" }, file: first },
		]);
		expect(upload).toHaveBeenCalledTimes(1);
		expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
	});

	it("取消确认失败时关闭中的队列不消失，重试只再次确认取消", async () => {
		vi.spyOn(window, "confirm").mockReturnValue(true);
		const firstAttempt = createDeferred<{ url: string }>();
		const cancelAttempt = createDeferred<{ url: string }>();
		const upload = vi
			.fn<NonNullable<UploaderProps<{ url: string }>["upload"]>>()
			.mockImplementationOnce(async () => firstAttempt.promise)
			.mockImplementationOnce(async (_file, _progress, signal) => {
				expect(signal?.aborted).toBe(true);
				return cancelAttempt.promise;
			});
		const { container } = renderUploader({ upload });
		selectFiles(container, [file("a.png")]);
		await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
		fireEvent.click(screen.getByRole("button", { name: /关闭/ }));
		await act(async () => firstAttempt.reject(new Error("取消接口不可用")));
		await waitFor(() => expect(uploadRow("a.png").dataset.state).toBe("error"));
		expect(document.querySelector(".v-upload-queue")).not.toBeNull();
		fireEvent.click(within(uploadRow("a.png")).getByRole("button", { name: /重试/ }));
		await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
		await act(async () => cancelAttempt.reject(new DOMException("取消", "AbortError")));
		await waitFor(() => expect(document.querySelector(".v-upload-queue")).toBeNull());
	});

	it("批次执行期间不通知刷新，提前展示只消费已成功项，空闲再通知剩余结果", async () => {
		const firstAttempt = createDeferred<{ url: string }>();
		const secondAttempt = createDeferred<{ url: string }>();
		const upload = vi
			.fn<NonNullable<UploaderProps<{ url: string }>["upload"]>>()
			.mockImplementationOnce(async () => firstAttempt.promise)
			.mockImplementationOnce(async () => secondAttempt.promise);
		const onBatchUploaded = vi.fn();
		const onPendingUploadedChange = vi.fn();
		const onUploaded = vi.fn();
		const { container } = renderUploader({
			upload,
			onUploaded,
			onBatchUploaded,
			onPendingUploadedChange,
			entry: "button",
		});
		const first = file("a.png");
		const second = file("b.png");
		selectFiles(container, [first, second]);
		await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
		await act(async () => firstAttempt.resolve({ url: "/a.png" }));
		await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
		expect(onUploaded).toHaveBeenCalledTimes(1);
		expect(onBatchUploaded).not.toHaveBeenCalled();
		expect(onPendingUploadedChange).toHaveBeenLastCalledWith(1);
		fireEvent.click(screen.getByRole("button", { name: /展示已上传/ }));
		expect(onBatchUploaded).toHaveBeenCalledExactlyOnceWith([
			{ result: { url: "/a.png" }, file: first },
		]);
		expect(onPendingUploadedChange).toHaveBeenLastCalledWith(0);
		await act(async () => secondAttempt.resolve({ url: "/b.png" }));
		await waitFor(() => expect(onBatchUploaded).toHaveBeenCalledTimes(2));
		expect(onBatchUploaded).toHaveBeenLastCalledWith([
			{ result: { url: "/b.png" }, file: second },
		]);
	});

	it("批次最后一项失败仍刷新已成功项，错误保留原任务供重试", async () => {
		const firstAttempt = createDeferred<{ url: string }>();
		const secondAttempt = createDeferred<{ url: string }>();
		const upload = vi
			.fn<NonNullable<UploaderProps<{ url: string }>["upload"]>>()
			.mockImplementationOnce(async () => firstAttempt.promise)
			.mockImplementationOnce(async () => secondAttempt.promise);
		const onBatchUploaded = vi.fn();
		const { container } = renderUploader({ upload, onBatchUploaded });
		const first = file("a.png");
		selectFiles(container, [first, file("b.png")]);
		await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
		await act(async () => firstAttempt.resolve({ url: "/a.png" }));
		await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
		expect(onBatchUploaded).not.toHaveBeenCalled();
		await act(async () => secondAttempt.reject(new Error("上传失败")));
		await waitFor(() => expect(onBatchUploaded).toHaveBeenCalledTimes(1));
		expect(onBatchUploaded).toHaveBeenCalledExactlyOnceWith([
			{ result: { url: "/a.png" }, file: first },
		]);
		expect(uploadRow("b.png").dataset.state).toBe("error");
	});

	it("缺失有效恢复时刻时暂停并保留手动恢复策略", async () => {
		const upload = vi
			.fn<NonNullable<UploaderProps<{ url: string }>["upload"]>>()
			.mockRejectedValueOnce(
				new ApiError({ error: "RATE_LIMITED", message: "请求受限", status: 429 }),
			)
			.mockResolvedValue({ url: "/a.png" });
		const { container } = renderUploader({ upload });
		selectFiles(container, [file("a.png")]);
		await waitFor(() => expect(uploadRow("a.png").dataset.state).toBe("error"));
		expect(document.querySelector<HTMLElement>(".v-upload-queue")?.dataset.policy).toBe(
			"paused",
		);
		fireEvent.click(screen.getByRole("button", { name: /继续上传/ }));
		expect(upload).toHaveBeenCalledTimes(1);
		fireEvent.click(within(uploadRow("a.png")).getByRole("button", { name: /重试/ }));
		await waitFor(() => expect(uploadRow("a.png").dataset.state).toBe("done"));
		expect(upload).toHaveBeenCalledTimes(2);
	});

	it("配置加载与失败时只排队，重试配置后使用真实并发策略", async () => {
		const ready = createDeferred<void>();
		let requests = 0;
		httpClient.defaults.adapter = async (config) => {
			requests++;
			if (requests === 1) {
				await ready.promise;
				throw new Error("配置读取失败");
			}
			return {
				config,
				status: 200,
				statusText: "OK",
				headers: {},
				data: { data: { version: 1, max_concurrent_files: 1 } },
			};
		};
		const upload = vi.fn(async () => ({ url: "/a.png" }));
		const { container } = renderUploader({ upload });
		selectFiles(container, [file("a.png")]);
		expect(document.querySelector<HTMLElement>(".v-upload-queue")?.dataset.policy).toBe(
			"loading",
		);
		expect(uploadRow("a.png").dataset.state).toBe("queued");
		expect(upload).not.toHaveBeenCalled();
		await act(async () => ready.resolve());
		await waitFor(() =>
			expect(document.querySelector<HTMLElement>(".v-upload-queue")?.dataset.policy).toBe(
				"error",
			),
		);
		expect(upload).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: /重试配置/ }));
		await waitFor(() => expect(uploadRow("a.png").dataset.state).toBe("done"));
		expect(upload).toHaveBeenCalledTimes(1);
	});

	it("服务端恢复期限内取消确认失败的重试保持禁用", async () => {
		const pending = createDeferred<{ url: string }>();
		const upload = vi.fn(async () => pending.promise);
		const { container } = renderUploader({ upload });
		selectFiles(container, [file("a.png")]);
		await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
		fireEvent.click(within(uploadRow("a.png")).getByRole("button", { name: /取消/ }));
		await act(async () =>
			pending.reject(
				new ApiError({
					error: "RATE_LIMITED",
					message: "取消请求受限",
					status: 429,
					retryAt: Date.now() + 60_000,
				}),
			),
		);
		await waitFor(() => expect(uploadRow("a.png").dataset.state).toBe("error"));
		const retry = within(uploadRow("a.png")).getByRole("button", { name: /重试/ });
		expect((retry as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(retry);
		expect(upload).toHaveBeenCalledTimes(1);
	});

	it("原生按钮选择与全局拖放只交给一个页面入口，卸载释放本地预览", async () => {
		const pending = createDeferred<{ url: string }>();
		const upload = vi.fn(async () => pending.promise);
		const otherUpload = vi.fn(async () => pending.promise);
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		clients.add(client);
		const { container, unmount } = render(
			<QueryClientProvider client={client}>
				<Uploader entry="button" label="上传素材" upload={upload} />
				<Uploader entry="button" label="其他入口" upload={otherUpload} />
			</QueryClientProvider>,
		);
		const input = container.querySelector("input[type=file]");
		if (!input) throw new Error("缺少文件选择入口");
		const nativeClick = vi.spyOn(input as HTMLInputElement, "click");
		fireEvent.click(screen.getByRole("button", { name: "上传素材" }));
		expect(nativeClick).toHaveBeenCalledTimes(1);
		const dataTransfer = { types: ["Files"], files: [file("a.png")], dropEffect: "none" };
		fireEvent.dragEnter(window, { dataTransfer });
		fireEvent.drop(window, { dataTransfer });
		await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
		expect(otherUpload).not.toHaveBeenCalled();
		unmount();
		expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:preview-1");
		await act(async () => pending.reject(new DOMException("取消", "AbortError")));
	});
});
