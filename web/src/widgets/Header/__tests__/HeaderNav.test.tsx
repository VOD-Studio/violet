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

function renderAt(path: string, authenticated = false) {
	const root = createRootRoute({
		component: () => (
			<>
				<HeaderNav authenticated={authenticated} />
				<Outlet />
			</>
		),
	});
	const empty = () => null;
	const router = createRouter({
		routeTree: root.addChildren([
			createRoute({ getParentRoute: () => root, path: "/", component: empty }),
			createRoute({ getParentRoute: () => root, path: "/blog", component: empty }),
			createRoute({ getParentRoute: () => root, path: "/tweets", component: empty }),
			createRoute({ getParentRoute: () => root, path: "/chat", component: empty }),
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
		expect(collapsed).toHaveLength(4);
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

		await router.navigate({ to: "/tweets" });
		await waitFor(() => expect(segmented.dataset.expanded).toBe("false"));
		expect(currentItem(segmented)?.textContent).toBe("推文");
	});

	it("一级入口随登录态：游客没有聊天，登录后聊天排在推文之后", async () => {
		renderAt("/", false);
		const guest = await findNav();
		expect(items(guest.segmented).map((item) => item.textContent)).toEqual([
			"首页",
			"博客",
			"手记",
			"推文",
			"更多",
		]);
		cleanup();

		renderAt("/", true);
		const member = await findNav();
		expect(items(member.segmented).map((item) => item.textContent)).toEqual([
			"首页",
			"博客",
			"手记",
			"推文",
			"聊天",
			"更多",
		]);
	});

	it("聊天子页让聊天一级入口保持选中", async () => {
		renderAt("/chat", true);
		const { segmented } = await findNav();
		expect(currentItem(segmented)?.textContent).toBe("聊天");
	});
});
