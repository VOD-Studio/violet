import { useLinkConfirmStore } from "@features/auth/model/link-confirm-store";
import { GITHUB_BIND_INTENT_KEY } from "@features/profile/ui/ConnectionsSection";
import { ApiError } from "@shared/api/error";
import { apiPost } from "@shared/api/request";
import { useSessionStore } from "@shared/api/session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render } from "@testing-library/react";
import { type ComponentType, StrictMode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "../auth.github.callback";

const router = vi.hoisted(() => ({ code: "github-code", navigate: vi.fn() }));

vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual("@tanstack/react-router")),
	useSearch: () => ({ code: router.code }),
	useNavigate: () => router.navigate,
}));

vi.mock("@shared/api/request", () => ({
	apiPost: vi.fn(),
	apiGet: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
}));

vi.mock("@features/profile/ui/ConnectionsSection", () => ({
	GITHUB_BIND_INTENT_KEY: "violet:github-bind-intent",
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

async function flushMutationUpdates() {
	for (let tick = 0; tick < 12; tick++) {
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1);
		});
	}
}

describe("GitHub 授权回调", () => {
	let qc: QueryClient;
	let resolveResponse: (value: unknown) => void;
	let rejectResponse: (reason: unknown) => void;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		router.code = "github-code";
		sessionStorage.clear();
		useSessionStore.setState({ sessionActive: false, sessionVersion: 0 });
		useLinkConfirmStore.getState().close();
		vi.mocked(apiPost).mockReturnValue(
			new Promise((resolve, reject) => {
				resolveResponse = resolve;
				rejectResponse = reject;
			}),
		);
		qc = new QueryClient({
			defaultOptions: {
				queries: { retry: false, gcTime: Infinity },
				mutations: { retry: false, gcTime: Infinity },
			},
		});
	});

	afterEach(() => {
		cleanup();
		qc.clear();
		vi.useRealTimers();
		sessionStorage.clear();
		useSessionStore.setState({ sessionActive: false, sessionVersion: 0 });
		useLinkConfirmStore.getState().close();
	});

	function renderCallback(bind: boolean, strict: boolean) {
		if (bind) sessionStorage.setItem(GITHUB_BIND_INTENT_KEY, "1");
		return render(callbackTree(strict));
	}

	function callbackTree(strict: boolean) {
		const Component = Route.options.component as ComponentType;
		const tree = (
			<QueryClientProvider client={qc}>
				<Component />
			</QueryClientProvider>
		);
		return strict ? <StrictMode>{tree}</StrictMode> : tree;
	}

	it.each([
		{ bind: false, strict: false },
		{ bind: true, strict: false },
		{ bind: false, strict: true },
		{ bind: true, strict: true },
	])("只提交一次并在成功后跳转，bind=$bind strict=$strict", async ({ bind, strict }) => {
		const view = renderCallback(bind, strict);
		await flushMutationUpdates();
		view.rerender(callbackTree(strict));
		await flushMutationUpdates();

		expect(apiPost).toHaveBeenCalledTimes(1);
		expect(apiPost).toHaveBeenCalledWith(
			bind ? "/auth/connections/github" : "/auth/github",
			bind ? { credential: undefined, code: "github-code" } : { credential: "github-code" },
			expect.any(Object),
		);
		expect(sessionStorage.getItem(GITHUB_BIND_INTENT_KEY)).toBeNull();
		expect(router.navigate).not.toHaveBeenCalled();

		await act(async () => resolveResponse({ user_id: "user-1" }));
		await flushMutationUpdates();

		expect(apiPost).toHaveBeenCalledTimes(1);
		expect(router.navigate).toHaveBeenCalledExactlyOnceWith({
			to: bind ? "/profile" : "/",
			replace: true,
		});
		expect(useSessionStore.getState().sessionActive).toBe(!bind);
	});

	it.each([false, true])("StrictMode 下失败不重发并返回原入口，bind=%s", async (bind) => {
		renderCallback(bind, true);
		await flushMutationUpdates();
		await act(async () => rejectResponse(new Error("授权码无效")));
		await flushMutationUpdates();

		expect(apiPost).toHaveBeenCalledTimes(1);
		expect(router.navigate).toHaveBeenCalledExactlyOnceWith({
			to: bind ? "/profile" : "/login",
			replace: true,
		});
		expect(toast.error).toHaveBeenCalledExactlyOnceWith(
			bind ? "GitHub 绑定失败：授权码无效" : "GitHub 登录失败",
		);
	});

	it.each([false, true])("离开回调页后迟到的结果不再跳转，bind=%s", async (bind) => {
		const view = renderCallback(bind, true);
		await flushMutationUpdates();
		view.unmount();
		await act(async () => resolveResponse({ user_id: "user-1" }));
		await flushMutationUpdates();

		expect(apiPost).toHaveBeenCalledTimes(1);
		expect(router.navigate).not.toHaveBeenCalled();
		expect(toast.success).not.toHaveBeenCalled();
	});

	it("新的授权码可以处理且仅当前授权结果触发跳转", async () => {
		const view = renderCallback(false, true);
		await flushMutationUpdates();
		router.code = "next-github-code";
		view.rerender(callbackTree(true));
		await flushMutationUpdates();
		await act(async () => resolveResponse({ user_id: "user-1" }));
		await flushMutationUpdates();

		expect(apiPost).toHaveBeenCalledTimes(2);
		expect(apiPost).toHaveBeenLastCalledWith(
			"/auth/github",
			{ credential: "next-github-code" },
			expect.any(Object),
		);
		expect(router.navigate).toHaveBeenCalledExactlyOnceWith({ to: "/", replace: true });
	});

	it("StrictMode 下 409 转接绑定确认弹窗且不重发授权码", async () => {
		renderCallback(false, true);
		await flushMutationUpdates();
		await act(async () =>
			rejectResponse(
				new ApiError({
					error: "LINK_CONFIRMATION_REQUIRED",
					message: "需要确认绑定",
					status: 409,
					data: {
						link_token: "test-link-token",
						email: "u***@example.com",
						has_password: true,
						provider: "GitHub",
					},
				}),
			),
		);
		await flushMutationUpdates();

		expect(apiPost).toHaveBeenCalledTimes(1);
		expect(useLinkConfirmStore.getState().payload?.linkToken).toBe("test-link-token");
		expect(router.navigate).toHaveBeenCalledExactlyOnceWith({ to: "/login", replace: true });
		expect(toast.error).not.toHaveBeenCalled();
	});
});
