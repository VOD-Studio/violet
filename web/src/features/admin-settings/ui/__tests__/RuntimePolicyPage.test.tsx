import type { RuntimePolicyView, UploadQueuePolicy } from "@entities/runtime-policy/model/types";
import { UploadQueuePolicyPage } from "@features/admin-settings/ui/UploadQueuePolicyPage";
import { ApiError } from "@shared/api/error";
import { apiGet, apiPut } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({ update: true }));
const blocker = vi.hoisted(() => vi.fn());
vi.mock("@features/auth/hooks/usePermissions", () => ({ useHasPermission: () => access.update }));
vi.mock("@tanstack/react-router", () => ({ useBlocker: blocker }));
vi.mock("@features/admin-layout/ui/PageShell", () => ({
	PageShell: ({
		title,
		action,
		children,
	}: {
		title: string;
		action: React.ReactNode;
		children: React.ReactNode;
	}) => (
		<main>
			<h1>{title}</h1>
			{action}
			{children}
		</main>
	),
}));
vi.mock("@shared/api/request", () => ({ apiGet: vi.fn(), apiPut: vi.fn() }));

function view(version = 1): RuntimePolicyView<UploadQueuePolicy> {
	return {
		version,
		values: { max_concurrent_files: 3 },
		defaults: { max_concurrent_files: 3 },
		sources: { max_concurrent_files: "application" },
		runtime: {
			version,
			values: { max_concurrent_files: 3 },
			status: "applied",
			activation: "browser_scheduling",
			instance_id: "test-instance",
			applied_at: "2026-10-22T00:00:00Z",
			last_checked_at: "2026-10-22T00:00:00Z",
		},
		presets: [
			{
				id: "bulk",
				label: "批量上传",
				description: "提高后续文件调度并发",
				values: { max_concurrent_files: 6 },
			},
		],
	};
}

function openPage() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
	});
	const result = render(
		<QueryClientProvider client={client}>
			<UploadQueuePolicyPage />
		</QueryClientProvider>,
	);
	return { ...result, client };
}

beforeEach(() => {
	vi.clearAllMocks();
	access.update = true;
	vi.mocked(apiGet).mockResolvedValue(view());
	vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());

describe("运行策略设置", () => {
	it("字段修改只改变草稿，保存携带基准版本且应用失败不显示已生效", async () => {
		const saved = view(2);
		saved.values = { max_concurrent_files: 5 };
		saved.runtime.status = "failed";
		saved.runtime.version = 1;
		saved.runtime.error = "应用失败";
		vi.mocked(apiPut).mockResolvedValue(saved);
		const page = openPage();
		fireEvent.click(await screen.findByText("高级参数"));
		fireEvent.change(screen.getByLabelText("文件并发数（个）"), { target: { value: "5" } });
		expect(apiPut).not.toHaveBeenCalled();
		expect(blocker).toHaveBeenLastCalledWith(
			expect.objectContaining({ enableBeforeUnload: true }),
		);
		fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
		await waitFor(() =>
			expect(apiPut).toHaveBeenCalledWith("/admin/settings/upload-queue", {
				expected_version: 1,
				values: { max_concurrent_files: 5 },
			}),
		);
		expect(await screen.findByText("已保存，当前实例尚未应用此版本")).toBeTruthy();
		expect(screen.queryByText("已保存，当前实例已应用")).toBeNull();
		page.client.clear();
	});

	it("409和后台刷新保留草稿，必须明确重新加载", async () => {
		vi.mocked(apiPut).mockRejectedValue(
			new ApiError({ error: "CONFLICT", status: 409, message: "版本冲突" }),
		);
		const page = openPage();
		fireEvent.click(await screen.findByText("高级参数"));
		fireEvent.change(screen.getByLabelText("文件并发数（个）"), { target: { value: "6" } });
		fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
		await screen.findByText("服务器配置已变化，草稿已保留。请重新加载后再编辑保存。");
		expect(screen.getByLabelText("文件并发数（个）")).toHaveProperty("value", "6");
		fireEvent.change(screen.getByLabelText("文件并发数（个）"), { target: { value: "4" } });
		expect(screen.getByRole("button", { name: "保存设置" })).toHaveProperty("disabled", true);
		vi.mocked(apiGet).mockResolvedValue(view(2));
		fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
		await waitFor(() =>
			expect(screen.getByLabelText("文件并发数（个）")).toHaveProperty("value", "3"),
		);
		expect(window.confirm).toHaveBeenCalled();
		page.client.clear();
	});

	it("只读用户不能选择预设、恢复默认或修改字段", async () => {
		access.update = false;
		const page = openPage();
		await screen.findByText("只读");
		fireEvent.click(screen.getByText("高级参数"));
		expect(screen.getByRole("combobox")).toHaveProperty("disabled", true);
		expect(screen.getByRole("button", { name: "恢复默认" })).toHaveProperty("disabled", true);
		expect(screen.getByLabelText("文件并发数（个）")).toHaveProperty("disabled", true);
		expect(screen.queryByRole("button", { name: "保存设置" })).toBeNull();
		page.client.clear();
	});

	it("恢复默认只产生草稿，显式保存才发送reset", async () => {
		vi.mocked(apiPut).mockResolvedValue(view(2));
		const page = openPage();
		fireEvent.click(await screen.findByRole("button", { name: "恢复默认" }));
		expect(apiPut).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
		await waitFor(() =>
			expect(apiPut).toHaveBeenCalledWith("/admin/settings/upload-queue", {
				expected_version: 1,
				reset: true,
			}),
		);
		page.client.clear();
	});

	it("加载失败可重试，字段错误直接可见", async () => {
		vi.mocked(apiGet).mockRejectedValueOnce(new Error("配置不可用"));
		vi.mocked(apiPut).mockRejectedValue(
			new ApiError({
				error: "VALIDATION",
				status: 400,
				message: "字段无效",
				details: { max_concurrent_files: ["并发必须在 1–10 之间"] },
			}),
		);
		const page = openPage();
		fireEvent.click(await screen.findByRole("button", { name: "重试" }));
		fireEvent.click(await screen.findByText("高级参数"));
		fireEvent.change(screen.getByLabelText("文件并发数（个）"), { target: { value: "5" } });
		fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
		expect(await screen.findByText("并发必须在 1–10 之间")).toBeTruthy();
		page.client.clear();
	});

	it("说明入口可以点击和键盘打开并按Escape关闭", async () => {
		const page = openPage();
		fireEvent.click(await screen.findByText("高级参数"));
		const help = screen.getByRole("button", { name: "文件并发数（个）说明" });
		fireEvent.click(help);
		expect((await screen.findByRole("tooltip")).textContent).toContain("跨批次共用并发上限");
		fireEvent.keyDown(help, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
		fireEvent.focus(help);
		expect(await screen.findByRole("tooltip")).toBeTruthy();
		page.client.clear();
	});
});
