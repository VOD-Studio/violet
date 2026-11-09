import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { PageHeader } from "../page-header";

afterEach(cleanup);

describe("PageHeader", () => {
	it("标题是页面唯一的 h1，说明与操作按区域渲染", () => {
		const ref = createRef<HTMLElement>();
		render(
			<PageHeader
				ref={ref}
				title="文章"
				description="共 270 篇，3 篇待发布"
				actions={<button type="button">导出</button>}
				primaryAction={<button type="button">写文章</button>}
			/>,
		);
		expect(screen.getByRole("heading", { level: 1, name: "文章" })).toBeTruthy();
		expect(screen.getByText("共 270 篇，3 篇待发布")).toBeTruthy();
		expect(screen.getByRole("button", { name: "导出" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "写文章" })).toBeTruthy();
		expect(ref.current?.tagName).toBe("HEADER");
	});

	it("详情页返回链接写清去哪，状态跟在标题后", () => {
		render(
			<PageHeader
				title="拆解 Saber"
				back={{ href: "/admin/posts", label: "文章" }}
				status="草稿"
				meta="11-02 14:20 自动保存 · 3,880 字"
			/>,
		);
		const back = screen.getByRole("link", { name: "返回文章" });
		expect(back.getAttribute("href")).toBe("/admin/posts");
		expect(screen.getByText("草稿")).toBeTruthy();
		expect(screen.getByText("11-02 14:20 自动保存 · 3,880 字")).toBeTruthy();
	});

	it("面包屑与标签页作为页头的一部分渲染", () => {
		render(
			<PageHeader
				title="设置"
				breadcrumbs={<nav aria-label="当前位置">管理 / 设置</nav>}
				tabs={<div role="tablist" aria-label="设置分区" />}
			/>,
		);
		expect(screen.getByRole("navigation", { name: "当前位置" })).toBeTruthy();
		expect(screen.getByRole("tablist", { name: "设置分区" })).toBeTruthy();
	});

	it("窄条形态只改呈现，不复制标题或操作", () => {
		render(
			<PageHeader
				title="文章"
				description="共 270 篇"
				actions={<button type="button">导出</button>}
				primaryAction={<button type="button">写文章</button>}
				compact
				compactSummary="270 篇"
			/>,
		);
		const header = document.querySelector(".v-page-header");
		expect(header?.hasAttribute("data-compact")).toBe(true);
		expect(screen.getAllByRole("heading", { level: 1, name: "文章" })).toHaveLength(1);
		expect(screen.getAllByRole("button", { name: "写文章" })).toHaveLength(1);
		expect(screen.getByText("270 篇")).toBeTruthy();
	});
});
