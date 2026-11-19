import type { ProjectRoadmapSummary } from "@entities/project/model/roadmap-summary";
import type { Project } from "@entities/project/model/types";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@violet/ui";
import { describe, expect, it, vi } from "vitest";
import { ProjectCard } from "../ProjectCard";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		to,
		params,
		children,
		className,
	}: React.ComponentProps<"a"> & { to: string; params: { slug: string } }) => (
		<a href={to.replace("$slug", params.slug)} className={className}>
			{children}
		</a>
	),
}));

const summary = (overrides: Partial<ProjectRoadmapSummary> = {}): ProjectRoadmapSummary => ({
	progress: { planned: 3, in_progress: 2, completed: 12, total: 17, percent: 71 },
	in_progress: [
		{ id: "i4", number: 4, title: "进行中的第一项", completion_date: null },
		{ id: "i5", number: 5, title: "进行中的第二项", completion_date: null },
	],
	latest_completed: {
		id: "i17",
		number: 17,
		title: "最近完成的一项",
		completion_date: "2026-10-20",
	},
	...overrides,
});

const release = {
	tag: "v1.4.0",
	published_at: "2026-10-29T08:00:00Z",
	count: 12,
	html_url: "https://github.com/example/violet/releases/tag/v1.4.0",
};

const project = (overrides: Partial<Project> = {}): Project => ({
	id: "p1",
	title: "Violet",
	slug: "violet",
	description: "一个博客系统",
	url: "",
	github_url: "",
	docs_url: "",
	status: "stable",
	image_url: "",
	tech_stack: ["Go", "React"],
	sort_order: 1,
	created_at: "2026-08-01T00:00:00Z",
	roadmap: summary(),
	...overrides,
});

describe("ProjectCard", () => {
	it("标题链接进入项目详情，徽章显示稳定迭代", () => {
		render(<ProjectCard project={project()} />);

		const heading = screen.getByRole("heading", { level: 2, name: "Violet" });
		expect(within(heading).getByRole("link").getAttribute("href")).toBe("/projects/violet");
		expect(screen.getByText("稳定迭代")).toBeTruthy();
		expect(screen.getAllByRole("link")).toHaveLength(1);
	});

	it("显示简介与技术栈；没有简介或技术栈时不留空块", () => {
		const { rerender } = render(<ProjectCard project={project()} />);
		expect(screen.getByText("一个博客系统")).toBeTruthy();
		expect(screen.getByRole("list", { name: "技术栈" }).textContent).toBe("GoReact");

		rerender(<ProjectCard project={project({ description: "", tech_stack: [] })} />);
		expect(screen.queryByText("一个博客系统")).toBeNull();
		expect(screen.queryByRole("list", { name: "技术栈" })).toBeNull();

		rerender(<ProjectCard project={project({ tech_stack: null as unknown as string[] })} />);
		expect(screen.queryByRole("list", { name: "技术栈" })).toBeNull();
	});

	it("没有发布时使用路线图原始进度与最多两条在做事项", () => {
		const roadmap = summary();
		roadmap.in_progress.push({ id: "i6", number: 6, title: "更多事项", completion_date: null });
		render(<ProjectCard project={project({ roadmap })} />);

		const doing = screen.getByRole("list", { name: "正在做" });
		expect(
			within(doing)
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(["#4 进行中的第一项", "#5 进行中的第二项"]);
		expect(screen.queryByText("更多事项")).toBeNull();
		expect(screen.queryByText("最近完成的一项")).toBeNull();
		const bar = screen.getByRole("progressbar", { name: "Violet 已完成占比" });
		expect(bar.getAttribute("aria-valuenow")).toBe("71");
		expect(screen.getByText("12 / 17 · 71%")).toBeTruthy();
	});

	it("只有规划中的条目时，显示零进度而不显示空的正在做列表", () => {
		render(
			<ProjectCard
				project={project({
					roadmap: summary({
						progress: {
							planned: 2,
							in_progress: 0,
							completed: 0,
							total: 2,
							percent: 0,
						},
						in_progress: [],
						latest_completed: null,
					}),
				})}
			/>,
		);

		expect(screen.queryByText("正在做")).toBeNull();
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
		expect(screen.getByText("0 / 2 · 0%")).toBeTruthy();
	});

	it("路线图为空或未提供时，不显示摘要区与进度条", () => {
		const { rerender } = render(
			<ProjectCard
				project={project({
					roadmap: summary({
						progress: {
							planned: 0,
							in_progress: 0,
							completed: 0,
							total: 0,
							percent: 0,
						},
						in_progress: [],
						latest_completed: null,
					}),
				})}
			/>,
		);
		expect(screen.queryByRole("progressbar")).toBeNull();
		expect(screen.queryByText("路线图")).toBeNull();

		rerender(<ProjectCard project={project({ roadmap: undefined })} />);
		expect(screen.queryByRole("progressbar")).toBeNull();
		expect(screen.queryByText("路线图")).toBeNull();
		expect(screen.getByRole("link", { name: "Violet" })).toBeTruthy();
	});

	it("稳定迭代的项目优先显示版本、发布日期和发布数量", () => {
		const { rerender } = render(<ProjectCard project={project({ release })} />);

		expect(screen.getByRole("link", { name: "v1.4.0" }).getAttribute("href")).toBe(
			release.html_url,
		);
		expect(screen.getByText("2026-10-29").getAttribute("datetime")).toBe(release.published_at);
		expect(screen.getByText("12 个版本")).toBeTruthy();
		expect(screen.queryByRole("progressbar")).toBeNull();

		rerender(
			<ProjectCard
				project={project({
					release: { ...release, html_url: "https://github.com/example/violet/issues/1" },
				})}
			/>,
		);
		expect(screen.getByText("v1.4.0")).toBeTruthy();
		expect(screen.queryByRole("link", { name: "v1.4.0" })).toBeNull();
	});

	it("进行中的项目以路线图为主且保留已发布的版本链接", () => {
		const pending = project({ status: "active", release });
		const { rerender } = render(<ProjectCard project={pending} />);
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("71");
		expect(screen.getByRole("list", { name: "正在做" }).textContent).toContain(
			"进行中的第一项",
		);
		const releaseLink = screen.getByRole("link", { name: release.tag });
		expect(releaseLink.getAttribute("href")).toBe(release.html_url);
		expect(
			screen.getByRole("progressbar").compareDocumentPosition(releaseLink) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();

		rerender(
			<ProjectCard
				project={{
					...pending,
					roadmap: summary({
						progress: {
							planned: 0,
							in_progress: 0,
							completed: 0,
							total: 0,
							percent: 0,
						},
						in_progress: [],
						latest_completed: null,
					}),
				}}
			/>,
		);
		expect(screen.queryByRole("progressbar")).toBeNull();
		expect(screen.getByRole("link", { name: release.tag })).toBeTruthy();
	});

	it("安全的访问、GitHub 与文档地址各有独立链接，危险或非绝对地址不显示", () => {
		const { rerender } = render(
			<ProjectCard
				project={project({
					url: "https://example.com/demo",
					github_url: "https://github.com/example/violet",
					docs_url: "/guide#getting-started",
				})}
			/>,
			{ wrapper: TooltipProvider },
		);
		expect(screen.getByRole("link", { name: "访问项目" }).getAttribute("href")).toBe(
			"https://example.com/demo",
		);
		expect(screen.getByRole("link", { name: "GitHub" }).getAttribute("href")).toBe(
			"https://github.com/example/violet",
		);
		const docs = screen.getByRole("link", { name: "文档" });
		expect(docs.getAttribute("href")).toBe("/guide#getting-started");
		expect(docs.getAttribute("target")).toBeNull();
		expect(docs.parentElement?.closest("a")).toBeNull();

		rerender(
			<ProjectCard
				project={project({
					url: "example.com/demo",
					github_url: "javascript:alert(1)",
					docs_url: "/\\other.example/guide",
				})}
			/>,
		);
		expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["Violet"]);
	});

	it("无专用插画的项目缺图或加载失败时显示首字母占位", () => {
		const generic = project({ slug: "generic" });
		const { container, rerender } = render(<ProjectCard project={generic} />);
		expect(screen.getByTestId("project-cover-placeholder").textContent).toBe("V");

		rerender(<ProjectCard project={{ ...generic, image_url: "/uploads/cover.png" }} />);
		const image = container.querySelector("img") as HTMLImageElement;
		expect(image.getAttribute("alt")).toBe("");
		expect(screen.queryByTestId("project-cover-placeholder")).toBeNull();

		fireEvent.error(image);
		expect(container.querySelector("img")).toBeNull();
		expect(screen.getByTestId("project-cover-placeholder").textContent).toBe("V");
	});

	it("已配置的项目封面优先，失效时用画板插画，换图后采用新配置", () => {
		const { container, rerender } = render(<ProjectCard project={project()} />);
		const fallback = container.querySelector("img")?.getAttribute("src");
		expect(fallback).toMatch(/violet-cover.*\.webp$/);

		rerender(<ProjectCard project={project({ image_url: "/uploads/a.png" })} />);
		const configured = container.querySelector("img") as HTMLImageElement;
		expect(configured.getAttribute("src")).toContain("/uploads/a.png");
		fireEvent.error(configured);
		expect(container.querySelector("img")?.getAttribute("src")).toBe(fallback);

		rerender(<ProjectCard project={project({ image_url: "/uploads/b.png" })} />);
		expect(container.querySelector("img")?.getAttribute("src")).toContain("/uploads/b.png");
	});
});
