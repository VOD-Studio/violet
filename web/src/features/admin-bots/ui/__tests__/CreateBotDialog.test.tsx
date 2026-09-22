import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
});
