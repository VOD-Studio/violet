import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mediaFile } = vi.hoisted(() => ({
	mediaFile: {
		id: "media-1",
		owner_id: "user-1",
		purpose: "material",
		original_name: "saber.png",
		url: "/uploads/saber.png",
		size: 1024,
		mime_type: "image/png",
		thumbnail: "/uploads/saber-thumb.png",
		status: "active",
		alt_text: "Saber 立绘",
		created_at: "2026-01-01T00:00:00Z",
	},
}));

// 真实的素材库弹层是嵌套 Modal，jsdom 下 Radix 不会走完退场动画；
// 本用例只关心对话框自己的载荷，弹层换成一个直接回传素材的桩。
vi.mock("@entities/media/ui/MediaPicker", () => ({
	MediaPicker: ({ open, onConfirm }: { open: boolean; onConfirm: (files: unknown[]) => void }) =>
		open ? (
			<button type="button" onClick={() => onConfirm([mediaFile])}>
				桩选素材
			</button>
		) : null,
}));

vi.mock("@shared/api/request", () => ({
	apiGetPaged: vi.fn(),
	apiPost: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
}));

import { apiPost } from "@shared/api/request";
import { CreateBotDialog } from "../CreateBotDialog";

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(apiPost).mockResolvedValue({ token: "violet_bot_issued" });
});

afterEach(() => cleanup());

function renderDialog(onCreated = vi.fn()) {
	const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
	render(
		<QueryClientProvider client={qc}>
			<CreateBotDialog open onOpenChange={vi.fn()} onCreated={onCreated} />
		</QueryClientProvider>,
	);
	return onCreated;
}

describe("CreateBotDialog", () => {
	it("用户名不合规则拦下请求", () => {
		renderDialog();
		fireEvent.change(screen.getByLabelText("显示名"), { target: { value: "Saber" } });
		fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "骑士" } });
		fireEvent.click(screen.getByRole("button", { name: "注册并签发 token" }));
		expect(apiPost).not.toHaveBeenCalled();
	});

	it("提交修剪后的名称并回传一次性 token", async () => {
		const onCreated = renderDialog();
		fireEvent.change(screen.getByLabelText("显示名"), { target: { value: "  Saber  " } });
		fireEvent.change(screen.getByLabelText("用户名"), { target: { value: " saber " } });
		fireEvent.click(screen.getByRole("button", { name: "注册并签发 token" }));

		await waitFor(() =>
			expect(apiPost).toHaveBeenCalledWith("/admin/chat-bots", {
				name: "Saber",
				username: "saber",
			}),
		);
		await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
		expect(onCreated.mock.calls[0][0].token).toBe("violet_bot_issued");
	});

	it("选定头像后注册请求带上素材 ID", async () => {
		renderDialog();
		fireEvent.click(screen.getByRole("button", { name: "选择头像" }));
		fireEvent.click(screen.getByRole("button", { name: "桩选素材" }));
		fireEvent.change(screen.getByLabelText("显示名"), { target: { value: "Saber" } });
		fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "saber" } });
		fireEvent.click(screen.getByRole("button", { name: "注册并签发 token" }));

		await waitFor(() =>
			expect(apiPost).toHaveBeenCalledWith("/admin/chat-bots", {
				name: "Saber",
				username: "saber",
				avatar_id: "media-1",
			}),
		);
	});
});
