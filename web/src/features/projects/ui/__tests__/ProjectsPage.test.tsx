import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Project, ProjectStatus } from "../../model/types";
import { type ProjectFilter, ProjectsPage } from "../ProjectsPage";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, params }: { children: React.ReactNode; params?: { slug: string } }) => (
		<a href={`/projects/${params?.slug}`}>{children}</a>
	),
}));

const project = (id: string, title: string, status: ProjectStatus = "active"): Project => ({
	id,
	title,
	slug: id,
	description: "",
	url: "",
	github_url: "",
	docs_url: "",
	status,
	image_url: "",
	tech_stack: [],
	sort_order: 0,
	created_at: "2026-08-01T00:00:00Z",
});

const renderPage = (initialData: Project[], filter: ProjectFilter = "all") =>
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<ProjectsPage initialData={initialData} filter={filter} onFilterChange={vi.fn()} />
		</QueryClientProvider>,
	);

describe("ProjectsPage", () => {
	it("按给出的顺序排列，不按标题或时间重排", () => {
		renderPage([project("c", "Zeta"), project("a", "Alpha"), project("b", "Mid")]);

		expect(
			screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent),
		).toEqual(["Zeta", "Alpha", "Mid"]);
	});

	it("进行中包含稳定迭代，保留原展示顺序，全部显示未筛选的总数", () => {
		renderPage(
			[
				project("s", "Stable", "stable"),
				project("x", "Archived", "archived"),
				project("a", "Active"),
			],
			"active",
		);

		expect(
			screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent),
		).toEqual(["Stable", "Active"]);
		expect(screen.getByRole("radio", { name: /全部\s*3/ })).toBeTruthy();
		expect(screen.getByRole("radio", { name: "进行中", checked: true })).toBeTruthy();
	});

	it("当前筛选无结果时仍保留全部的真实项目总数", () => {
		renderPage([project("a", "Active")], "archived");

		expect(screen.getByRole("status").textContent).toContain("没有符合当前筛选的项目");
		expect(screen.getByRole("radio", { name: /全部\s*1/ })).toBeTruthy();
	});

	it("没有项目时显示空状态", () => {
		renderPage([]);

		expect(screen.getByRole("status").textContent).toContain("暂无项目");
		expect(screen.getByRole("radio", { name: /全部\s*0/, checked: true })).toBeTruthy();
		expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
	});

	it("页面标题始终在", () => {
		renderPage([project("a", "Alpha")]);

		expect(screen.getByRole("heading", { level: 1, name: "项目" })).toBeTruthy();
	});
});
