import { DEFAULT_DECORATION_LAYERS } from "@shared/lib/decoration-preference";
import type { Season, ThemeState } from "@shared/lib/theme-preference";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { normalizeTheme } from "@violetjs/theme";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeMenu } from "../ThemeMenu";

function renderMenu(theme: ThemeState, appearance?: ReactNode) {
	const root = createRootRoute({
		beforeLoad: () => ({
			theme,
			decoration: "theme" as const,
			decorationLayers: DEFAULT_DECORATION_LAYERS,
		}),
		component: () => (
			<>
				<ThemeMenu appearance={appearance} />
				<Outlet />
			</>
		),
	});
	const router = createRouter({
		routeTree: root.addChildren([
			createRoute({ getParentRoute: () => root, path: "/", component: () => null }),
		]),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	render(<RouterProvider router={router} />);
}

const preset = (season: Season): ThemeState => ({
	preference: "follow",
	preset: season,
	custom: null,
});

describe("ThemeMenu", () => {
	afterEach(cleanup);

	it.each([
		["spring", "花朝"],
		["summer", "荷风"],
		["autumn", "桂月"],
		["winter", "初雪"],
	] as const)("%s 季入口名称带主题名「%s」", async (season, name) => {
		renderMenu(preset(season));
		expect(await screen.findByRole("button", { name: `季节与外观：${name}` })).toBeTruthy();
	});

	it("自定义主题生效时入口名称写自定义", async () => {
		renderMenu({
			preference: "follow",
			preset: "spring",
			custom: normalizeTheme({ version: 1, seed: THEME_PRESETS.spring.seed }),
		});
		expect(await screen.findByRole("button", { name: "季节与外观：自定义" })).toBeTruthy();
	});

	it("面板顶部是宿主传入的外观，其后是主题配色", async () => {
		renderMenu(preset("autumn"), <button type="button">外观切换器</button>);
		fireEvent.click(await screen.findByRole("button", { name: "季节与外观：桂月" }));
		const panel = await screen.findByRole("dialog", { name: "季节与外观" });
		const appearance = within(panel).getByRole("region", { name: "外观" });
		expect(within(appearance).getByRole("button", { name: "外观切换器" })).toBeTruthy();
		const theme = within(panel).getByRole("region", { name: "主题配色" });
		expect(
			appearance.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("宿主不传外观时面板没有外观一节", async () => {
		renderMenu(preset("autumn"));
		fireEvent.click(await screen.findByRole("button", { name: "季节与外观：桂月" }));
		const panel = await screen.findByRole("dialog", { name: "季节与外观" });
		expect(within(panel).queryByRole("region", { name: "外观" })).toBeNull();
		expect(within(panel).getByRole("region", { name: "主题配色" })).toBeTruthy();
	});
});
