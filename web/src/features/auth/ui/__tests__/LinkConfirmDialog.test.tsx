/**
 * LinkConfirmDialog 确认成功后的路由行为测试。
 *
 * 确认绑定成功即完成登录：/login 页发起时必须显式跳转离开——
 * beforeLoad 只在进入路由时跑，invalidate me 不会把已登录用户带离登录页，
 * 否则用户停在登录页看到「绑定成功，已登录」却无法离开。
 * 登录弹窗（其他页面）发起时无需导航，弹窗收起即可。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// mock 整个 request 模块（列出所有导出，避免别处 import 拿到 undefined）
vi.mock("@shared/api/request", () => ({
	apiPost: vi.fn(),
	apiGet: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
	apiPut: vi.fn(),
	apiGetPaged: vi.fn(),
}));

// mock csrf：confirmLink 走 getCSRFToken() 读 cookie，固定返回空避免 jsdom cookie 干扰
vi.mock("@shared/api/csrf", () => ({
	CSRF_HEADER: "X-CSRF-Token",
	getCSRFToken: vi.fn(() => ""),
}));

import { apiGet, apiPost } from "@shared/api/request";
import { useLinkConfirmStore } from "../../model/link-confirm-store";
import { LinkConfirmDialog } from "../LinkConfirmDialog";

/** 409 响应体对应的弹窗 payload（hasPassword=true 才有密码确认表单） */
const PAYLOAD = {
	linkToken: "lt-1",
	email: "a***@x.com",
	hasPassword: true,
	provider: "Google",
};

/**
 * 以 memory history router 渲染全局挂载的 LinkConfirmDialog。
 * LinkConfirmDialog 挂在 root（模拟 __root 全局挂载），搜索参数透传。
 */
async function renderAt(initialUrl: string) {
	const rootRoute = createRootRoute({
		component: () => (
			<>
				<LinkConfirmDialog />
				<Outlet />
			</>
		),
	});
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => null,
	});
	const loginRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/login",
		validateSearch: (s: Record<string, unknown>) => s,
		component: () => null,
	});
	const tweetsRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/tweets",
		component: () => null,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([indexRoute, loginRoute, tweetsRoute]),
		history: createMemoryHistory({ initialEntries: [initialUrl] }),
	});
	const qc = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={qc}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
	await router.load();
	return router;
}

/** 打开弹窗、填密码、点确认绑定 */
async function submitConfirm() {
	useLinkConfirmStore.getState().open(PAYLOAD);
	const password = await screen.findByLabelText("密码");
	fireEvent.change(password, { target: { value: "password123" } });
	fireEvent.click(screen.getByRole("button", { name: "确认绑定" }));
}

describe("LinkConfirmDialog 确认成功后的导航", () => {
	beforeEach(() => {
		vi.mocked(apiPost).mockResolvedValue({ user_id: "u1" });
		vi.mocked(apiGet).mockResolvedValue({ csrf_token: "t" });
	});

	afterEach(() => {
		useLinkConfirmStore.getState().close();
		vi.clearAllMocks();
	});

	it("/login 页确认成功后按 redirect 参数跳转", async () => {
		const router = await renderAt("/login?redirect=/tweets");
		await submitConfirm();
		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/tweets");
		});
	});

	it("/login 页无 redirect 参数时跳回首页", async () => {
		const router = await renderAt("/login");
		await submitConfirm();
		await waitFor(() => {
			expect(router.state.location.pathname).toBe("/");
		});
	});

	it("非 /login 页（登录弹窗发起）确认成功后原地停留并关闭弹窗", async () => {
		const router = await renderAt("/");
		await submitConfirm();
		await waitFor(() => {
			expect(useLinkConfirmStore.getState().payload).toBeNull();
		});
		expect(router.state.location.pathname).toBe("/");
	});
});
