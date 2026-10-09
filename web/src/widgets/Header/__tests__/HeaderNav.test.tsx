import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HeaderNav from "../HeaderNav";

interface Post {
	title: string;
}

function renderAt(path: string) {
	const root = createRootRoute({
		component: () => (
			<>
				<HeaderNav />
				<Outlet />
			</>
		),
	});
	const empty = () => null;
	const router = createRouter({
		routeTree: root.addChildren([
			createRoute({ getParentRoute: () => root, path: "/", component: empty }),
			createRoute({ getParentRoute: () => root, path: "/blog", component: empty }),
			createRoute({ getParentRoute: () => root, path: "/series", component: empty }),
			createRoute({
				getParentRoute: () => root,
				path: "/blog/$slug",
				component: empty,
				loader: (): Post => ({ title: "派早报：荣耀发布 Robot Phone" }),
				staticData: { navTitle: (post: Post) => post.title },
			}),
		]),
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	render(<RouterProvider router={router} />);
	return router;
}

const findNav = async () => {
	const nav = await screen.findByRole("navigation", { name: "主导航" });
	const segmented = nav.querySelector<HTMLElement>('[data-slot="segmented"]');
	if (!segmented) throw new Error("主导航缺少 Segmented");
	return { nav, segmented };
};
const items = (segmented: HTMLElement) =>
	Array.from(segmented.querySelectorAll<HTMLElement>("[data-segment-item]"));
const currentItem = (segmented: HTMLElement) =>
	items(segmented).find((item) => item.dataset.active === "true");

describe("HeaderNav", () => {
	afterEach(cleanup);

	it("文章详情页保持博客选中并显示文章标题，其余项收为图标", async () => {
		renderAt("/blog/hello");
		const { segmented } = await findNav();
		await waitFor(() => expect(segmented.dataset.expanded).toBe("true"));

		expect(currentItem(segmented)?.textContent).toBe("派早报：荣耀发布 Robot Phone");
		const collapsed = items(segmented).filter((item) => item.dataset.active === "false");
		expect(collapsed).toHaveLength(5);
		for (const item of collapsed) expect(item.getAttribute("title")).toBeTruthy();
	});

	it("列表页是常规标签态，不显示标题", async () => {
		renderAt("/blog");
		const { segmented } = await findNav();
		expect(segmented.dataset.expanded).toBe("false");
		expect(currentItem(segmented)?.textContent).toBe("博客");
	});

	it("离开详情页回到常规标签态", async () => {
		const router = renderAt("/blog/hello");
		const { segmented } = await findNav();
		await waitFor(() => expect(segmented.dataset.expanded).toBe("true"));

		await router.navigate({ to: "/series" });
		await waitFor(() => expect(segmented.dataset.expanded).toBe("false"));
		expect(currentItem(segmented)?.textContent).toBe("系列");
	});
});
