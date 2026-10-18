import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Project } from "../../model/types";
import { ProjectsPage } from "../ProjectsPage";

vi.mock("@tanstack/react-router", () => ({
	Link: ({ children, params }: { children: React.ReactNode; params?: { slug: string } }) => (
		<a href={`/projects/${params?.slug}`}>{children}</a>
	),
}));

const project = (id: string, title: string): Project => ({
	id,
	title,
	slug: id,
	description: "",
	url: "",
	github_url: "",
	image_url: "",
	tech_stack: [],
	sort_order: 0,
	created_at: "2026-08-01T00:00:00Z",
});

const renderPage = (initialData?: Project[]) =>
	render(
		<QueryClientProvider
			client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
		>
			<ProjectsPage initialData={initialData} />
		</QueryClientProvider>,
	);

describe("ProjectsPage", () => {
	it("按给出的顺序排列，不按标题或时间重排", () => {
		renderPage([project("c", "Zeta"), project("a", "Alpha"), project("b", "Mid")]);

		expect(
			screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent),
		).toEqual(["Zeta", "Alpha", "Mid"]);
	});

	it("没有项目时显示空状态", () => {
		renderPage([]);

		expect(screen.getByRole("status").textContent).toContain("暂无项目");
		expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
	});

	it("页面标题始终在", () => {
		renderPage([project("a", "Alpha")]);

		expect(screen.getByRole("heading", { level: 1, name: "项目" })).toBeTruthy();
	});
});
