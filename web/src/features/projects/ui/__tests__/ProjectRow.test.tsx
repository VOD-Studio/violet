import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectRoadmapSummary } from "../../model/roadmap-summary";
import type { Project } from "../../model/types";
import { ProjectRow } from "../ProjectRow";

// Link 退化为普通 <a>，脱离 RouterProvider 上下文；params 填进路径
vi.mock("@tanstack/react-router", () => ({
	Link: ({
		to,
		params,
		children,
		className,
	}: {
		to: string;
		params?: Record<string, string>;
		children: React.ReactNode;
		className?: string;
	}) => (
		<a
			href={to.replace(/\$(\w+)/g, (_, name: string) => params?.[name] ?? "")}
			className={className}
		>
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

const project = (overrides: Partial<Project> = {}): Project => ({
	id: "p1",
	title: "Violet",
	slug: "violet",
	description: "一个博客系统",
	url: "",
	github_url: "",
	image_url: "",
	tech_stack: ["Go", "React"],
	sort_order: 1,
	created_at: "2026-08-01T00:00:00Z",
	roadmap: summary(),
	...overrides,
});

describe("ProjectRow", () => {
	it("标题是进入详情页的链接，指向 /projects/<slug>", () => {
		render(<ProjectRow project={project()} />);

		const link = screen.getByRole("link", { name: "Violet" });
		expect(link.getAttribute("href")).toBe("/projects/violet");
		expect(screen.getAllByRole("link")).toHaveLength(1);
	});

	it("显示简介与技术栈；没有简介、没有技术栈时不留空块", () => {
		const { rerender } = render(<ProjectRow project={project()} />);
		expect(screen.getByText("一个博客系统")).toBeTruthy();
		expect(screen.getByRole("list", { name: "技术栈" }).textContent).toBe("GoReact");

		rerender(<ProjectRow project={project({ description: "", tech_stack: [] as string[] })} />);
		expect(screen.queryByText("一个博客系统")).toBeNull();
		expect(screen.queryByRole("list", { name: "技术栈" })).toBeNull();

		rerender(<ProjectRow project={project({ tech_stack: null as unknown as string[] })} />);
		expect(screen.queryByRole("list", { name: "技术栈" })).toBeNull();
	});

	it("现在在做：列出条目；最近完成：编号、标题与日期；进度条与三个数量", () => {
		render(<ProjectRow project={project()} />);

		const doing = screen.getByText("现在在做").parentElement as HTMLElement;
		expect(
			within(doing)
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(["#4进行中的第一项", "#5进行中的第二项"]);
		const latest = screen.getByText("最近完成").parentElement as HTMLElement;
		expect(latest.textContent).toContain("#17最近完成的一项2026-10-20");
		const bar = screen.getByRole("progressbar", { name: "Violet 已完成占比" });
		expect(bar.getAttribute("aria-valuenow")).toBe("71");
		expect(screen.getByText(/已完成 12\/17/).textContent).toBe(
			"已完成 12/17 · 进行中 2 · 计划中 3",
		);
	});

	it("没有进行中或没有已完成时给出明确的空说明", () => {
		render(
			<ProjectRow
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

		expect(screen.getByText("暂无进行中")).toBeTruthy();
		expect(screen.getByText("暂无")).toBeTruthy();
		expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
	});

	it("没有路线图条目（总数为 0）或读不到摘要时，不出现摘要区与进度条", () => {
		const { rerender } = render(
			<ProjectRow
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
		expect(screen.queryByText("现在在做")).toBeNull();
		expect(screen.queryByText("最近完成")).toBeNull();
		expect(screen.getByRole("link", { name: "Violet" })).toBeTruthy();

		rerender(<ProjectRow project={project({ roadmap: undefined })} />);
		expect(screen.queryByRole("progressbar")).toBeNull();
		expect(screen.queryByText("现在在做")).toBeNull();
	});

	it("最近完成缺日期时不显示空日期", () => {
		render(
			<ProjectRow
				project={project({
					roadmap: summary({
						latest_completed: {
							id: "x",
							number: 3,
							title: "无日期",
							completion_date: null,
						},
					}),
				})}
			/>,
		);

		const latest = screen.getByText("最近完成").parentElement as HTMLElement;
		expect(latest.textContent).toBe("最近完成#3无日期");
	});

	it("封面：没有地址显示首字母占位；有地址是装饰图，加载失败回落到占位", () => {
		const { container, rerender } = render(<ProjectRow project={project()} />);
		expect(screen.getByTestId("project-cover-placeholder").textContent).toBe("V");

		rerender(<ProjectRow project={project({ image_url: "/uploads/cover.png" })} />);
		const image = container.querySelector("img") as HTMLImageElement;
		expect(image.getAttribute("alt")).toBe("");
		expect(screen.queryByTestId("project-cover-placeholder")).toBeNull();

		fireEvent.error(image);
		expect(container.querySelector("img")).toBeNull();
		expect(screen.getByTestId("project-cover-placeholder").textContent).toBe("V");
	});

	it("封面地址变了，之前的失败记录不再生效", () => {
		const { container, rerender } = render(
			<ProjectRow project={project({ image_url: "/uploads/a.png" })} />,
		);
		fireEvent.error(container.querySelector("img") as HTMLImageElement);
		expect(container.querySelector("img")).toBeNull();

		rerender(<ProjectRow project={project({ image_url: "/uploads/b.png" })} />);

		expect(container.querySelector("img")?.getAttribute("src")).toContain("/uploads/b.png");
	});
});
