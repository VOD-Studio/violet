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
import { useNavbarState } from "../use-navbar-state";

interface Post {
	title: string;
}

function Probe({ authenticated }: { authenticated: boolean }) {
	const { items, active, title } = useNavbarState(authenticated);
	return (
		<output data-testid="state">
			{JSON.stringify({
				labels: items.map((item) => item.label),
				active: active ? { item: active.item.label, link: active.link.label } : null,
				title,
			})}
		</output>
	);
}

function renderAt(path: string, authenticated = false) {
	const root = createRootRoute({
		component: () => (
			<>
				<Probe authenticated={authenticated} />
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
			createRoute({ getParentRoute: () => root, path: "/projects", component: empty }),
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

const state = async () => {
	const output = await screen.findByTestId("state");
	return JSON.parse(output.textContent ?? "null") as {
		labels: string[];
		active: { item: string; link: string } | null;
		title: string | null;
	};
};

describe("useNavbarState", () => {
	afterEach(cleanup);

	it("详情页保持所属栏目选中，并给出详情标题", async () => {
		renderAt("/blog/hello");
		await waitFor(async () =>
			expect((await state()).title).toBe("派早报：荣耀发布 Robot Phone"),
		);
		expect((await state()).active?.item).toBe("博客");
	});

	it("列表页没有详情标题", async () => {
		renderAt("/blog");
		const current = await state();
		expect(current.title).toBeNull();
		expect(current.active?.link).toBe("文章");
	});

	it("离开详情页后标题随之消失，选中项跟着换", async () => {
		const router = renderAt("/blog/hello");
		await waitFor(async () => expect((await state()).title).not.toBeNull());

		await router.navigate({ to: "/tweets" });
		await waitFor(async () => expect((await state()).active?.item).toBe("推文"));
		expect((await state()).title).toBeNull();
	});

	it("更多里的子页归属更多分组并给出子页名", async () => {
		renderAt("/projects");
		const current = await state();
		expect(current.active).toEqual({ item: "更多", link: "项目" });
	});

	it("入口随登录态：登录后多出聊天", async () => {
		renderAt("/", false);
		expect((await state()).labels).not.toContain("聊天");
		cleanup();

		renderAt("/", true);
		expect((await state()).labels).toContain("聊天");
	});
});
