import { ApiError } from "@shared/api/error";
import { apiPost } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplyDialog } from "../ApplyDialog";

vi.mock("@features/auth/api/queries", () => ({ useCsrfToken: () => "csrf" }));
vi.mock("@shared/api/request", () => ({ apiPost: vi.fn(), apiGet: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let queryClient: QueryClient;
beforeEach(() => {
	vi.clearAllMocks();
	queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: Infinity },
			mutations: { retry: false, gcTime: Infinity },
		},
	});
});
afterEach(() => {
	cleanup();
	queryClient.clear();
});

function renderApplication() {
	return render(
		<QueryClientProvider client={queryClient}>
			<ApplyDialog open onOpenChange={vi.fn()} isLoggedIn={false} />
		</QueryClientProvider>,
	);
}

describe("匿名友链申请验证码", () => {
	it("发送失败可立即重试，修改邮箱后丢弃旧发送结果", async () => {
		const oldRequest = Promise.withResolvers<null>();
		vi.mocked(apiPost).mockReturnValueOnce(oldRequest.promise);
		renderApplication();
		const email = screen.getByRole("textbox", { name: "联系邮箱（仅留存，不公开）" });
		fireEvent.change(email, { target: { value: "old@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
		fireEvent.change(email, { target: { value: "new@example.com" } });
		await act(async () => oldRequest.resolve(null));
		expect(screen.queryByRole("group", { name: "邮箱验证码" })).toBeNull();
		vi.mocked(apiPost).mockRejectedValueOnce(ApiError.network()).mockResolvedValueOnce(null);
		const send = screen.getByRole("button", { name: "发送验证码" });
		fireEvent.click(send);
		await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
		fireEvent.click(send);
		await screen.findByRole("group", { name: "邮箱验证码" });
		expect(apiPost).toHaveBeenLastCalledWith("/friend-links/code", {
			email: "new@example.com",
		});
	});

	it("申请验证码错误返回身份步骤，反馈后清空归焦，不改写申请payload", async () => {
		vi.mocked(apiPost).mockImplementation((path) =>
			path === "/friend-links"
				? Promise.reject(
						new ApiError({
							error: "BAD_REQUEST",
							status: 400,
							message: "验证码错误或已过期",
						}),
					)
				: Promise.resolve(null),
		);
		renderApplication();
		fireEvent.change(screen.getByRole("textbox", { name: "联系邮箱（仅留存，不公开）" }), {
			target: { value: "reader@example.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
		const group = await screen.findByRole("group", { name: "邮箱验证码" });
		fireEvent.paste(within(group).getByRole("textbox", { name: "第 1 位" }), {
			clipboardData: { getData: () => "482951" },
		});
		fireEvent.click(screen.getByRole("button", { name: "递出名片" }));
		fireEvent.change(await screen.findByLabelText("站名 *"), { target: { value: "读者博客" } });
		fireEvent.change(screen.getByLabelText("站点 URL *"), {
			target: { value: "https://reader.example" },
		});
		fireEvent.click(screen.getByRole("button", { name: "完成交换" }));
		const invalidGroup = await screen.findByRole("group", { name: "邮箱验证码" });
		expect(invalidGroup.getAttribute("aria-invalid")).toBe("true");
		await waitFor(() =>
			expect(
				within(invalidGroup)
					.getAllByRole("textbox")
					.every((input) => (input as HTMLInputElement).value === ""),
			).toBe(true),
		);
		expect(document.activeElement).toBe(
			within(invalidGroup).getByRole("textbox", { name: "第 1 位" }),
		);
		expect(apiPost).toHaveBeenCalledWith("/friend-links", {
			name: "读者博客",
			url: "https://reader.example",
			avatar_url: "",
			description: "",
			owner_name: "",
			linkback_url: "",
			contact_email: "reader@example.com",
			code: "482951",
		});
	});
});
