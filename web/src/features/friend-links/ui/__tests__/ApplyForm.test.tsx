import { ApiError } from "@shared/api/error";
import { apiPost } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplyForm } from "../ApplyForm";

vi.mock("@features/auth/api/queries", () => ({ useCsrfToken: () => "csrf" }));
vi.mock("@shared/api/request", () => ({ apiPost: vi.fn(), apiGetPaged: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

let queryClient: QueryClient;
beforeEach(() => {
	vi.resetAllMocks();
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

function renderApplication(isLoggedIn = false) {
	return render(
		<QueryClientProvider client={queryClient}>
			<ApplyForm isLoggedIn={isLoggedIn} username={isLoggedIn ? "reader" : undefined} />
		</QueryClientProvider>,
	);
}

function fillSite() {
	fireEvent.change(screen.getByRole("textbox", { name: "站名" }), {
		target: { value: "读者博客" },
	});
	fireEvent.change(screen.getByRole("textbox", { name: "地址" }), {
		target: { value: "https://reader.example" },
	});
	fireEvent.change(screen.getByRole("textbox", { name: "RSS 地址" }), {
		target: { value: "https://reader.example/feed.xml" },
	});
}

describe("友链申请", () => {
	it("未验证的匿名申请不能提交，页面保留 RSS 草稿", async () => {
		renderApplication();
		fillSite();
		fireEvent.submit(screen.getByRole("form", { name: "申请友链" }));
		expect((await screen.findByRole("alert")).textContent).toBe("请先完成邮箱验证码验证");
		expect(apiPost).not.toHaveBeenCalled();
		expect((screen.getByRole("textbox", { name: "RSS 地址" }) as HTMLInputElement).value).toBe(
			"https://reader.example/feed.xml",
		);
	});

	it("发送失败可立即重试，换邮箱后丢弃旧发送结果", async () => {
		const oldRequest = Promise.withResolvers<null>();
		vi.mocked(apiPost).mockReturnValueOnce(oldRequest.promise);
		renderApplication();
		const email = screen.getByRole("textbox", { name: "联系邮箱" });
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

	it("验证码拒绝后清空归焦，保留站点和 RSS，并发送原验证码", async () => {
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
		fillSite();
		fireEvent.change(screen.getByRole("textbox", { name: "联系邮箱" }), {
			target: { value: "reader@example.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: "发送验证码" }));
		const group = await screen.findByRole("group", { name: "邮箱验证码" });
		fireEvent.paste(within(group).getByRole("textbox", { name: "第 1 位" }), {
			clipboardData: { getData: () => "482951" },
		});
		fireEvent.submit(screen.getByRole("form", { name: "申请友链" }));
		await waitFor(() => expect(group.getAttribute("aria-invalid")).toBe("true"));
		await waitFor(() =>
			expect(
				within(group)
					.getAllByRole("textbox")
					.every((input) => (input as HTMLInputElement).value === ""),
			).toBe(true),
		);
		expect(document.activeElement).toBe(
			within(group).getByRole("textbox", { name: "第 1 位" }),
		);
		expect((screen.getByRole("textbox", { name: "RSS 地址" }) as HTMLInputElement).value).toBe(
			"https://reader.example/feed.xml",
		);
		expect(apiPost).toHaveBeenCalledWith("/friend-links", {
			name: "读者博客",
			url: "https://reader.example",
			avatar_url: "",
			description: "",
			rss_url: "https://reader.example/feed.xml",
			owner_name: "",
			linkback_url: "",
			contact_email: "reader@example.com",
			code: "482951",
		});
	});

	it("登录申请跳过验证码，真实成功后展示等待审核回执", async () => {
		vi.mocked(apiPost).mockResolvedValueOnce(null);
		renderApplication(true);
		fillSite();
		expect(screen.queryByRole("button", { name: "发送验证码" })).toBeNull();
		fireEvent.submit(screen.getByRole("form", { name: "申请友链" }));
		await screen.findByText("申请已提交");
		expect(apiPost).toHaveBeenCalledWith(
			"/friend-links",
			expect.objectContaining({
				rss_url: "https://reader.example/feed.xml",
				code: undefined,
				contact_email: "",
			}),
		);
	});
});
