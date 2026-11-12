import { ApiError } from "@shared/api/error";
import { apiPost } from "@shared/api/request";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route as ForgotPasswordRoute } from "../forgot-password";
import { Route as RegisterRoute } from "../register";

const router = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual("@tanstack/react-router")),
	useNavigate: () => router.navigate,
	Link: ({ children }: { children: ReactNode }) => <a href="/login">{children}</a>,
}));
vi.mock("@features/auth/api/queries", () => ({
	useCsrfToken: () => "csrf",
	clearAuthCache: vi.fn(),
}));
vi.mock("@shared/api/request", () => ({
	apiPost: vi.fn(),
	apiGet: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
}));
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

function renderRoute(Component: ComponentType) {
	return render(
		<QueryClientProvider client={queryClient}>
			<Component />
		</QueryClientProvider>,
	);
}

async function startRegistration() {
	renderRoute(RegisterRoute.options.component as ComponentType);
	fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "reader@example.com" } });
	fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "reader" } });
	fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password-123" } });
	fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "password-123" } });
	fireEvent.click(screen.getByRole("button", { name: "注册" }));
	return screen.findByRole("group", { name: "邮箱验证码" });
}

function enterCode(group: HTMLElement) {
	fireEvent.paste(within(group).getByRole("textbox", { name: "第 1 位" }), {
		clipboardData: { getData: () => "482951" },
	});
}

function readCode(group: HTMLElement) {
	return within(group)
		.getAllByRole("textbox")
		.map((input) => (input as HTMLInputElement).value)
		.join("");
}

const verificationCalls = () =>
	vi.mocked(apiPost).mock.calls.filter(([path]) => path === "/auth/verify-email");

describe("注册邮箱验证码", () => {
	it("用户填满只验证一次，重渲染与成功状态不会重复提交", async () => {
		const verification = Promise.withResolvers<null>();
		vi.mocked(apiPost).mockImplementation((path) =>
			path === "/auth/verify-email" ? verification.promise : Promise.resolve(null),
		);
		const group = await startRegistration();
		enterCode(group);
		await waitFor(() => expect(verificationCalls()).toHaveLength(1));
		expect(
			within(group)
				.getAllByRole("textbox")
				.every((input) => (input as HTMLInputElement).disabled),
		).toBe(true);
		await act(async () => verification.resolve(null));
		await waitFor(() =>
			expect(router.navigate).toHaveBeenCalledWith({
				to: "/login",
				replace: true,
				search: { email: "reader@example.com" },
			}),
		);
		expect(verificationCalls()).toHaveLength(1);
	});

	it("明确验证码错误先保留错误码呈现反馈，再清空归焦且不循环请求", async () => {
		vi.mocked(apiPost).mockImplementation((path) =>
			path === "/auth/verify-email"
				? Promise.reject(
						new ApiError({
							error: "UNAUTHORIZED",
							status: 401,
							message: "账号或密码错误",
						}),
					)
				: Promise.resolve(null),
		);
		const group = await startRegistration();
		enterCode(group);
		await waitFor(() => expect(group.getAttribute("aria-invalid")).toBe("true"));
		expect(readCode(group)).toBe("482951");
		await waitFor(() => expect(readCode(group)).toBe(""));
		expect(document.activeElement).toBe(
			within(group).getByRole("textbox", { name: "第 1 位" }),
		);
		expect(verificationCalls()).toHaveLength(1);
	});

	it("网络失败保留已填验证码，并允许显式重新验证", async () => {
		vi.mocked(apiPost).mockImplementation((path) =>
			path === "/auth/verify-email"
				? Promise.reject(ApiError.network())
				: Promise.resolve(null),
		);
		const group = await startRegistration();
		enterCode(group);
		const retry = await screen.findByRole("button", { name: "重新验证" });
		expect(readCode(group)).toBe("482951");
		expect(group.getAttribute("aria-invalid")).toBe("false");
		fireEvent.click(retry);
		await waitFor(() => expect(verificationCalls()).toHaveLength(2));
	});

	it("重发失败不冷却可立即重试，成功后清除旧验证码", async () => {
		vi.mocked(apiPost).mockResolvedValue(null);
		const group = await startRegistration();
		fireEvent.change(within(group).getByRole("textbox", { name: "第 1 位" }), {
			target: { value: "4" },
		});
		vi.mocked(apiPost).mockRejectedValueOnce(ApiError.network()).mockResolvedValueOnce(null);
		const resend = screen.getByRole("button", { name: "重新发送" });
		fireEvent.click(resend);
		await waitFor(() => expect((resend as HTMLButtonElement).disabled).toBe(false));
		expect(readCode(group)).toBe("4");
		fireEvent.click(resend);
		await screen.findByRole("button", { name: /秒后可重新发送/ });
		expect(readCode(group)).toBe("");
	});
});

describe("忘记密码验证码", () => {
	it("填满验证码不重置密码，必须填写密码并显式提交", async () => {
		vi.mocked(apiPost).mockResolvedValue(null);
		renderRoute(ForgotPasswordRoute.options.component as ComponentType);
		fireEvent.change(screen.getByLabelText("注册邮箱"), {
			target: { value: "reader@example.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: "发送重置码" }));
		const group = await screen.findByRole("group", { name: "邮箱重置码" });
		enterCode(group);
		expect(
			vi.mocked(apiPost).mock.calls.filter(([path]) => path === "/auth/reset-password"),
		).toHaveLength(0);
		fireEvent.change(screen.getByLabelText("新密码"), { target: { value: "new-password" } });
		fireEvent.change(screen.getByLabelText("确认新密码"), {
			target: { value: "new-password" },
		});
		fireEvent.click(screen.getByRole("button", { name: "重置密码" }));
		await waitFor(() =>
			expect(apiPost).toHaveBeenCalledWith(
				"/auth/reset-password",
				{ email: "reader@example.com", code: "482951", new_password: "new-password" },
				expect.any(Object),
			),
		);
	});
});
