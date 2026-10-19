import { ApiError } from "@shared/api/error";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RoadmapDetail, RoadmapItem } from "../../model/roadmap";
import "../register";

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

const item = (number: number, overrides: Partial<RoadmapItem> = {}): RoadmapItem => ({
	id: `i${number}`,
	project_id: "p",
	number,
	title: `条目 ${number}`,
	description: "",
	stage: "planned",
	position: `a${number}`,
	tags: [],
	links: [],
	checklist: [],
	completion_date: null,
	delivered_version: "",
	blocked: false,
	created_at: "2026-10-01T00:00:00Z",
	updated_at: "2026-10-01T00:00:00Z",
	...overrides,
});

const detail: RoadmapDetail = {
	project: {
		id: "p",
		title: "kite",
		slug: "kite",
		description: "团队协作工具箱",
	} as RoadmapDetail["project"],
	items: [
		item(2, { title: "建立领域模型", blocked: true, tags: ["主线"] }),
		item(1, { title: "收敛执行入口", stage: "in_progress" }),
		item(9, {
			title: "发布 v0.3.0",
			stage: "completed",
			completion_date: "2026-10-17",
			delivered_version: "v0.3.0",
		}),
	],
	relations: [],
	progress: { planned: 1, in_progress: 1, completed: 1, total: 3, percent: 33 },
};

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(async (url: string) => {
		if (url === "/projects/by-slug/kite/roadmap") return detail;
		if (url === "/projects/by-slug/gone/roadmap")
			throw new ApiError({ error: "NOT_FOUND", message: "项目不存在", status: 404 });
		throw new ApiError({ error: "INTERNAL", message: "服务器出错", status: 500 });
	}),
	apiGetPaged: vi.fn(),
}));

/** 等卡片读到数据：加载中的框是另一个 figure，要先等内容出现再取它所在的卡片。 */
async function cardWith(text: string) {
	const node = await screen.findByText(text);
	const card = node.closest("figure");
	if (!card) throw new Error(`${text} is not inside an embed card`);
	return card as HTMLElement;
}

const fence = (source: string) => `<pre><code class="language-roadmap">${source}</code></pre>`;

function renderArticle(...sources: string[]) {
	return render(
		<QueryClientProvider client={new QueryClient()}>
			<ArticleContent content={sources.map(fence).join("")} />
		</QueryClientProvider>,
	);
}

describe("文章里的 roadmap 卡片", () => {
	it("条目卡片：阶段、编号、标题与被阻塞；点开是只读详情，链接到项目页", async () => {
		renderArticle('{"project":"kite","item":2,"display":"card"}');

		const card = await cardWith("建立领域模型");
		expect(card.textContent).toContain("计划中");
		expect(card.textContent).toContain("#2");
		expect(card.textContent).toContain("被阻塞");
		expect(within(card).getByRole("link", { name: "kite" }).getAttribute("href")).toBe(
			"/projects/kite",
		);

		fireEvent.click(within(card).getByRole("button", { name: /建立领域模型/ }));
		const dialog = await screen.findByRole("dialog", { name: "建立领域模型" });
		expect(within(dialog).queryByRole("button", { name: "编辑" })).toBeNull();
	});

	it("项目卡片：简介、进度概览、现在在做与最近完成", async () => {
		renderArticle('{"project":"kite"}');

		const card = await cardWith("团队协作工具箱");
		expect(within(card).getByRole("progressbar", { name: "已完成占比" })).toBeTruthy();
		expect(within(card).getByRole("region", { name: "现在在做" }).textContent).toContain(
			"收敛执行入口",
		);
		expect(within(card).getByRole("region", { name: "最近完成" }).textContent).toContain(
			"发布 v0.3.0",
		);
		expect(within(card).getByRole("link", { name: "查看完整路线图" })).toBeTruthy();
	});

	it("项目或条目不存在时降级为占位说明，读取出错时也不影响文章其余部分", async () => {
		renderArticle('{"project":"gone"}', '{"project":"kite","item":99}', '{"project":"broken"}');

		expect(await screen.findByText("项目「gone」不存在或已删除")).toBeTruthy();
		expect(await screen.findByText("kite 的条目 #99 不存在或已删除")).toBeTruthy();
		expect(await screen.findByText("路线图暂时无法读取，请稍后刷新")).toBeTruthy();
	});

	it("参数不合法时给出可读提示并保留原文", async () => {
		renderArticle(
			'{"project":"Kite!"}',
			'{"project":"kite","display":"board"}',
			'{"project":"kite","item":0}',
			"不是 JSON",
		);

		expect(await screen.findAllByText("无法解析 roadmap 卡片配置")).toHaveLength(4);
		expect(screen.getByText('{"project":"Kite!"}')).toBeTruthy();
	});
});
