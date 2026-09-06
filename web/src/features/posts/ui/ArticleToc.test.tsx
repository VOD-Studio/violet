import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import ArticleToc, { buildTree } from "./ArticleToc";

beforeAll(() => {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
});

beforeEach(() => {
	window.history.replaceState(null, "", "/");
});

const items = [
	{ level: 2 as const, id: "h2-1", text: "第一章" },
	{ level: 3 as const, id: "h3-1-1", text: "1.1 小节" },
	{ level: 3 as const, id: "h3-1-2", text: "1.2 小节" },
	{ level: 2 as const, id: "h2-2", text: "第二章" },
	{ level: 3 as const, id: "h3-2-1", text: "2.1 小节" },
	{ level: 4 as const, id: "h4-2-1-1", text: "2.1.1 细节" },
];

describe("buildTree", () => {
	it("从扁平标题构造完整层级树", () => {
		const tree = buildTree(items);
		expect(tree).toHaveLength(2);
		expect(tree[0].children.map((node) => node.id)).toEqual(["h3-1-1", "h3-1-2"]);
		expect(tree[1].children[0].children[0].id).toBe("h4-2-1-1");
	});
});

describe("ArticleToc", () => {
	it("完整保留全部标题节点，不生成更多截断项", () => {
		const tree = buildTree(items);
		const flatten = (nodes: typeof tree): string[] =>
			nodes.flatMap((node) => [node.text, ...flatten(node.children)]);
		expect(flatten(tree)).toEqual(items.map((item) => item.text));
		expect(flatten(tree)).not.toContain("更多");
	});

	it("点击完整一级标题链接触发导航", () => {
		const contentRef = createRef<HTMLElement>();
		const onNavigate = vi.fn();
		render(<ArticleToc items={items} contentRef={contentRef} onNavigate={onNavigate} />);
		fireEvent.click(screen.getByRole("link", { name: "第一章" }));
		expect(onNavigate).toHaveBeenCalledTimes(1);
	});

	it("点击子标题链接触发导航", () => {
		const contentRef = createRef<HTMLElement>();
		const onNavigate = vi.fn();
		render(<ArticleToc items={items} contentRef={contentRef} onNavigate={onNavigate} />);
		fireEvent.click(screen.getByRole("link", { name: "1.2 小节" }));
		expect(onNavigate).toHaveBeenCalledTimes(1);
	});

	it("折叠按钮只切换当前卡片内容", async () => {
		const contentRef = createRef<HTMLElement>();
		const onNavigate = vi.fn();
		render(<ArticleToc items={items} contentRef={contentRef} onNavigate={onNavigate} />);
		const collapse = screen.getByRole("button", { name: "收起 第一章" });
		fireEvent.click(collapse);
		expect(screen.getByRole("button", { name: "展开 第一章" })).toBeTruthy();
		await waitFor(() => expect(screen.queryByText("1.1 小节")).toBeNull());
		expect(onNavigate).not.toHaveBeenCalled();
	});

	it("可以手动展开非当前一级菜单", async () => {
		const contentRef = createRef<HTMLElement>();
		render(<ArticleToc items={items} contentRef={contentRef} />);

		expect(screen.queryByText("2.1 小节")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "展开 第二章" }));

		await waitFor(() => expect(screen.queryByText("2.1 小节")).not.toBeNull());
		expect(screen.getByRole("button", { name: "收起 第二章" })).toBeTruthy();
		await waitFor(() => expect(screen.queryByText("1.1 小节")).toBeNull());
	});

	it("点击标题链接保留文章路径并写入标题哈希", () => {
		const contentRef = createRef<HTMLElement>();
		const onNavigate = vi.fn();
		const anchorItems = [
			{
				level: 2 as const,
				id: "为什么我决定放弃-tailwind",
				text: "为什么我决定放弃 Tailwind",
			},
			{ level: 2 as const, id: "迁移实践", text: "迁移实践" },
		];
		window.history.replaceState(null, "", "/blog/css-to-stylex-migration");
		render(<ArticleToc items={anchorItems} contentRef={contentRef} onNavigate={onNavigate} />);

		const link = screen.getByRole("link", { name: "为什么我决定放弃 Tailwind" });
		expect(link.getAttribute("href")).toBe("#为什么我决定放弃-tailwind");
		fireEvent.click(link);

		expect(window.location.pathname).toBe("/blog/css-to-stylex-migration");
		expect(decodeURIComponent(window.location.hash)).toBe("#为什么我决定放弃-tailwind");
		expect(onNavigate).toHaveBeenCalledTimes(1);
	});
});
