import { chatKeys } from "@features/chat/api/keys";
import {
	DEFAULT_DECORATION_LAYERS,
	parseDecorationCookie,
	parseDecorationLayersCookie,
} from "@shared/lib/decoration-preference";
import {
	parseCustomThemeCookie,
	parseThemeCookie,
	resolvePresetTheme,
	type ThemeState,
} from "@shared/lib/theme-preference";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import HeaderActions from "@widgets/Header/HeaderActions";
import { ThemeProvider } from "next-themes";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@features/chat/hooks/useChatStream", () => ({ useChatStream: () => { } }));
vi.mock("@features/auth/hooks/usePermissions", () => ({ useHasPermission: () => false }));

function renderAppearance() {
	const fallback: ThemeState = { preference: "autumn", preset: "autumn", custom: null };
	const root = createRootRoute({
		beforeLoad: () => {
			const hasTheme = document.cookie.includes("theme-preference=");
			const preference = hasTheme ? parseThemeCookie(document.cookie) : fallback.preference;
			return {
				theme: {
					preference,
					preset: hasTheme ? resolvePresetTheme(preference, new Date()) : fallback.preset,
					custom: parseCustomThemeCookie(document.cookie),
				},
				decoration: parseDecorationCookie(document.cookie),
				decorationLayers:
					parseDecorationLayersCookie(document.cookie) ?? DEFAULT_DECORATION_LAYERS,
			};
		},
		component: () => (
			<>
				<HeaderActions />
				<button type="button">页面操作</button>
			</>
		),
	});
	const router = createRouter({
		routeTree: root.addChildren([
			createRoute({ getParentRoute: () => root, path: "/", component: () => null }),
		]),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	const query = new QueryClient({
		defaultOptions: { queries: { retry: false, staleTime: Infinity } },
	});
	query.setQueryData(chatKeys.unreadCount(), { unread_count: 0 });
	render(
		<QueryClientProvider client={query}>
			<ThemeProvider attribute="class" defaultTheme="light">
				<RouterProvider router={router} />
			</ThemeProvider>
		</QueryClientProvider>,
	);
}

async function openAppearance() {
	renderAppearance();
	const trigger = await screen.findByRole("button", { name: "季节与外观：桂月" });
	fireEvent.click(trigger);
	return { trigger, panel: await screen.findByRole("dialog", { name: "季节与外观" }) };
}

afterEach(() => {
	cleanup();
	localStorage.removeItem("theme");
	document.documentElement.classList.remove("light", "dark");
	for (const attribute of [
		"data-theme",
		"data-season",
		"data-decoration",
		"data-decoration-layers",
	])
		document.documentElement.removeAttribute(attribute);
	for (const cookie of document.cookie.split(";")) {
		// biome-ignore lint/suspicious/noDocumentCookie: 清理交互写入的偏好。
		document.cookie = `${cookie.split("=")[0].trim()}=; path=/; Max-Age=0`;
	}
});

describe("页头外观设置", () => {
	it("三态外观可连续切换并保留面板，方向键改变选择", async () => {
		const { panel } = await openAppearance();
		const group = within(panel).getByRole("radiogroup", { name: "外观切换" });
		for (const [name, value] of [
			["暗黑", "dark"],
			["跟随系统", "system"],
			["亮色", "light"],
		]) {
			const option = within(group).getByRole("radio", { name });
			fireEvent.click(option);
			await waitFor(() => expect(option.getAttribute("aria-checked")).toBe("true"));
			expect(localStorage.getItem("theme")).toBe(value);
			expect(screen.getByRole("dialog", { name: "季节与外观" })).toBe(panel);
		}
		const light = within(group).getByRole("radio", { name: "亮色" });
		act(() => light.focus());
		fireEvent.keyDown(light, { key: "ArrowRight" });
		await waitFor(() => expect(localStorage.getItem("theme")).toBe("dark"));
	});

	it.each([
		"取消",
		"应用",
		"Escape",
	] as const)("自定义主题通过 %s 返回胶囊设置，关闭后归还触发按钮焦点", async (action) => {
		const { trigger } = await openAppearance();
		const customize = screen.getByRole("button", { name: "自定义主题" });
		act(() => customize.focus());
		fireEvent.click(customize);
		const dialog = await screen.findByRole("dialog", { name: "自定义主题" });
		const seed = within(dialog).getByRole("textbox", { name: "种子色" });
		fireEvent.change(seed, { target: { value: "#336699" } });
		if (action === "Escape") fireEvent.keyDown(seed, { key: "Escape" });
		else fireEvent.click(within(dialog).getByRole("button", { name: action }));
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "自定义主题" })).toBeNull(),
		);
		await waitFor(() => expect(document.activeElement).toBe(customize));
		expect(screen.getByRole("dialog", { name: "季节与外观" })).toBeTruthy();
		if (action === "应用")
			await waitFor(() =>
				expect(parseCustomThemeCookie(document.cookie)?.seed).toBe("#336699"),
			);
		else expect(parseCustomThemeCookie(document.cookie)).toBeNull();
		fireEvent.keyDown(customize, { key: "Escape" });
		await waitFor(() => expect(document.activeElement).toBe(trigger));
	});

	it("取色器 Esc 只关闭最内层，取消返回仍展开的设置", async () => {
		await openAppearance();
		const customize = screen.getByRole("button", { name: "自定义主题" });
		act(() => customize.focus());
		fireEvent.click(customize);
		const dialog = await screen.findByRole("dialog", { name: "自定义主题" });
		fireEvent.click(within(dialog).getByRole("button", { name: "打开种子色取色面板" }));
		const picker = await screen.findByRole("dialog", { name: "种子色取色面板" });
		fireEvent.keyDown(within(picker).getByRole("textbox", { name: "面板种子色" }), {
			key: "Escape",
		});
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "种子色取色面板" })).toBeNull(),
		);
		expect(screen.getByRole("dialog", { name: "自定义主题" })).toBe(dialog);
		fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
		await waitFor(() => expect(document.activeElement).toBe(customize));
	});
});
