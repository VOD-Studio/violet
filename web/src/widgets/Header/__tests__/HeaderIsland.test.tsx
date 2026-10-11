import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HeaderIsland from "../HeaderIsland";

function renderAt(path: string) {
	const root = createRootRoute({
		component: () => (
			<>
				<HeaderIsland />
				<Outlet />
			</>
		),
	});
	const empty = () => null;
	const router = createRouter({
		routeTree: root.addChildren(
			["/", "/blog", "/blog/archive", "/series", "/galleries", "/lab", "/chat"].map((p) =>
				createRoute({ getParentRoute: () => root, path: p, component: empty }),
			),
		),
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	render(<RouterProvider router={router} />);
	return router;
}

describe("HeaderIsland", () => {
	afterEach(cleanup);

	it("收起时显示主要入口，当前页带文字标出，全部导航收在「更多」里", async () => {
		renderAt("/series");
		const nav = await screen.findByRole("navigation", { name: "移动端导航" });
		expect(nav.querySelectorAll("a")).toHaveLength(4);
		expect(nav.querySelector('a[aria-current="page"]')?.getAttribute("aria-label")).toBe(
			"系列",
		);
		expect(screen.queryByText("浏览本站", { exact: false })).toBeNull();
	});

	it("点「更多」展开全部导航，Esc 收起", async () => {
		renderAt("/");
		fireEvent.click(await screen.findByRole("button", { name: "展开全部导航" }));
		await screen.findByText("Violet · 浏览本站");
		expect(screen.getByRole("link", { name: "实验室" })).toBeTruthy();

		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() => expect(screen.queryByText("Violet · 浏览本站")).toBeNull());
	});

	it("导航后自动收起面板", async () => {
		const router = renderAt("/");
		fireEvent.click(await screen.findByRole("button", { name: "展开全部导航" }));
		await screen.findByText("Violet · 浏览本站");

		await act(async () => {
			await router.navigate({ to: "/blog" });
		});
		await waitFor(() => expect(screen.queryByText("Violet · 浏览本站")).toBeNull());
	});

	it.each([
		["/lab", "实验室"],
		["/blog/archive", "归档"],
	])("在 %s 用当前菜单替代更多入口，并仍可展开全部导航", async (path, label) => {
		renderAt(path);
		const more = await screen.findByRole("button", { name: `${label}，展开全部导航` });
		expect(more.getAttribute("aria-current")).toBe("page");
		expect(more.textContent).toBe(label);
		fireEvent.click(more);
		const selected = await screen.findByRole("link", { name: label });
		expect(selected.getAttribute("aria-current")).toBe("page");
	});

	it("聊天全屏页不显示，避免盖住输入栏", async () => {
		renderAt("/chat");
		await waitFor(() =>
			expect(screen.queryByRole("navigation", { name: "移动端导航" })).toBeNull(),
		);
	});
});
