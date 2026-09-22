import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/api/request", () => ({
	apiGetPaged: vi.fn(),
	apiPost: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
}));

import type { BotDTO } from "@features/admin-bots/model/types";
import type { DataTablePagination } from "@features/admin-shared/ui/data-table";
import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
import { BotTable } from "../BotTable";

const pagination: DataTablePagination = { page: 1, pageSize: 20, total: 2, onChange: vi.fn() };

function bot(overrides: Partial<BotDTO> = {}): BotDTO {
	return {
		id: "b1",
		user_id: "u1",
		username: "saber",
		name: "Saber",
		enabled: true,
		created_at: "2026-09-22T10:00:00Z",
		updated_at: "2026-09-22T10:00:00Z",
		...overrides,
	};
}

function renderTable(bots: BotDTO[], onTokenRotated = vi.fn()) {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(
		<QueryClientProvider client={qc}>
			<BotTable
				bots={bots}
				pagination={pagination}
				loading={false}
				onTokenRotated={onTokenRotated}
			/>
		</QueryClientProvider>,
	);
	return onTokenRotated;
}

beforeEach(() => {
	// mock 定义在模块级，调用记录跨用例累积；不清会让「未发请求」的断言误判。
	vi.clearAllMocks();
	vi.mocked(apiPatch).mockResolvedValue(bot());
	vi.mocked(apiPost).mockResolvedValue(bot({ token: "violet_bot_new" }));
	vi.mocked(apiDelete).mockResolvedValue(null);
});

afterEach(() => cleanup());

describe("BotTable", () => {
	it("渲染名称与可寻址用户名", () => {
		renderTable([bot(), bot({ id: "b2", username: "lancer", name: "Lancer" })]);
		expect(screen.getByText("Saber")).toBeTruthy();
		expect(screen.getByText("@lancer")).toBeTruthy();
	});

	it("拨动状态开关即以 enabled 补丁调用后端", () => {
		renderTable([bot()]);
		fireEvent.click(screen.getByRole("switch", { name: "禁用 Saber" }));
		waitFor(() => {
			expect(apiPatch).toHaveBeenCalledWith("/admin/chat-bots/b1", { enabled: false });
		});
	});

	it("吊销要先过确认框，确认后才发请求", () => {
		renderTable([bot()]);
		fireEvent.click(screen.getByRole("button", { name: "吊销 Saber" }));
		expect(apiDelete).not.toHaveBeenCalled();
		expect(screen.getByText(/历史消息保留/)).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "确认吊销" }));
		waitFor(() => expect(apiDelete).toHaveBeenCalledWith("/admin/chat-bots/b1"));
	});

	it("取消确认框则不发请求", () => {
		renderTable([bot()]);
		fireEvent.click(screen.getByRole("button", { name: "吊销 Saber" }));
		fireEvent.click(screen.getByRole("button", { name: "取消" }));
		expect(apiDelete).not.toHaveBeenCalled();
	});

	it("重置 token 成功后把新明文交给页面展示", async () => {
		const onTokenRotated = renderTable([bot()]);
		fireEvent.click(screen.getByRole("button", { name: "重置 Saber 的 token" }));
		fireEvent.click(screen.getByRole("button", { name: "确认重置" }));
		await waitFor(() =>
			expect(apiPost).toHaveBeenCalledWith("/admin/chat-bots/b1/regenerate-token"),
		);
		await waitFor(() => expect(onTokenRotated).toHaveBeenCalledOnce());
		expect(onTokenRotated.mock.calls[0][0].token).toBe("violet_bot_new");
	});
});
