import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 素材库弹层换成 feature 内的桩（见 __tests__/fixtures.tsx）：
// 真实 MediaPicker 是嵌套 Modal，jsdom 下 Radix 走不完退场动画，而用例只关心提交的载荷。
vi.mock("@entities/media/ui/MediaPicker", async () => {
	const { StubMediaPicker } = await import("../../__tests__/fixtures");
	return { MediaPicker: StubMediaPicker };
});

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
		show_thinking: false,
		token_viewable: true,
		created_at: "2026-09-22T10:00:00Z",
		updated_at: "2026-09-22T10:00:00Z",
		...overrides,
	};
}

function renderTable(bots: BotDTO[], onTokenRevealed = vi.fn()) {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(
		<QueryClientProvider client={qc}>
			<BotTable
				bots={bots}
				pagination={pagination}
				loading={false}
				onTokenRevealed={onTokenRevealed}
			/>
		</QueryClientProvider>,
	);
	return onTokenRevealed;
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

	it("拨动状态开关即以 enabled 补丁调用后端", async () => {
		renderTable([bot()]);
		fireEvent.click(screen.getByRole("switch", { name: "禁用 Saber" }));
		await waitFor(() =>
			expect(apiPatch).toHaveBeenCalledWith("/admin/chat-bots/b1", { enabled: false }),
		);
	});

	it("思考展示开关只提交 show_thinking 配置", async () => {
		renderTable([bot()]);
		fireEvent.click(screen.getByRole("switch", { name: "开启 Saber 的思考展示" }));
		await waitFor(() =>
			expect(apiPatch).toHaveBeenCalledWith("/admin/chat-bots/b1", { show_thinking: true }),
		);
	});

	it("点击名称进入就地编辑，失焦提交改名", async () => {
		renderTable([bot()]);
		fireEvent.click(screen.getByRole("button", { name: "Saber" }));

		const input = screen.getByRole("textbox", { name: "改名 Saber" });
		fireEvent.change(input, { target: { value: "  Saber Alter  " } });
		fireEvent.blur(input);

		await waitFor(() =>
			expect(apiPatch).toHaveBeenCalledWith("/admin/chat-bots/b1", { name: "Saber Alter" }),
		);
	});

	it("Esc 放弃与清空草稿都不发改名请求", () => {
		renderTable([bot()]);

		fireEvent.click(screen.getByRole("button", { name: "Saber" }));
		const escaped = screen.getByRole("textbox", { name: "改名 Saber" });
		fireEvent.change(escaped, { target: { value: "Renamed" } });
		fireEvent.keyDown(escaped, { key: "Escape" });
		fireEvent.blur(escaped);
		expect(apiPatch).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Saber" }));
		const blank = screen.getByRole("textbox", { name: "改名 Saber" });
		fireEvent.change(blank, { target: { value: "   " } });
		fireEvent.blur(blank);
		expect(apiPatch).not.toHaveBeenCalled();
	});

	it("从素材库选新头像即以 avatar_id 提交", async () => {
		renderTable([bot({ avatar_url: "/uploads/saber.png" })]);
		fireEvent.click(screen.getByRole("button", { name: "更换头像" }));
		fireEvent.click(screen.getByRole("button", { name: "桩选素材" }));

		await waitFor(() =>
			expect(apiPatch).toHaveBeenCalledWith("/admin/chat-bots/b1", { avatar_id: "media-1" }),
		);
	});

	it("点角标移除头像即以 avatar_id 空串提交", async () => {
		renderTable([bot({ avatar_id: "media-0", avatar_url: "/uploads/saber.png" })]);
		fireEvent.click(screen.getByRole("button", { name: "移除头像" }));

		await waitFor(() =>
			expect(apiPatch).toHaveBeenCalledWith("/admin/chat-bots/b1", { avatar_id: "" }),
		);
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
		const onTokenRevealed = renderTable([bot()]);
		fireEvent.click(screen.getByRole("button", { name: "重置 Saber 的 token" }));
		fireEvent.click(screen.getByRole("button", { name: "确认重置" }));
		await waitFor(() =>
			expect(apiPost).toHaveBeenCalledWith("/admin/chat-bots/b1/regenerate-token"),
		);
		await waitFor(() => expect(onTokenRevealed).toHaveBeenCalledOnce());
		expect(onTokenRevealed.mock.calls[0][0].token).toBe("violet_bot_new");
	});

	it("查看 token 仅回显凭据，不动库里那份", async () => {
		const onTokenRevealed = renderTable([bot()]);
		fireEvent.click(screen.getByRole("button", { name: "查看 Saber 的 token" }));
		await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/admin/chat-bots/b1/token"));
		expect(apiPatch).not.toHaveBeenCalled();
		expect(apiDelete).not.toHaveBeenCalled();
		await waitFor(() => expect(onTokenRevealed).toHaveBeenCalledOnce());
	});

	it("库里无密文可解时查看入口置灰且不发请求", () => {
		const onTokenRevealed = renderTable([bot({ token_viewable: false })]);
		const trigger = screen.getByRole("button", { name: "查看 Saber 的 token" });
		expect(trigger.hasAttribute("disabled")).toBe(true);

		fireEvent.click(trigger);
		expect(apiPost).not.toHaveBeenCalled();
		expect(onTokenRevealed).not.toHaveBeenCalled();
	});
});
