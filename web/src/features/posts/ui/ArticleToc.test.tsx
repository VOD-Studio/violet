import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
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

	it("点击完整一级卡头触发导航", () => {
		const contentRef = createRef<HTMLElement>();
		const onNavigate = vi.fn();
		render(<ArticleToc items={items} contentRef={contentRef} onNavigate={onNavigate} />);
		const cardHeader = screen.getByText("第一章").closest('[role="button"]');
		expect(cardHeader).toBeTruthy();
		if (cardHeader) fireEvent.click(cardHeader);
		expect(onNavigate).toHaveBeenCalledTimes(1);
	});

	it("点击子标题触发导航", () => {
		const contentRef = createRef<HTMLElement>();
		const onNavigate = vi.fn();
		render(<ArticleToc items={items} contentRef={contentRef} onNavigate={onNavigate} />);
		fireEvent.click(screen.getByRole("button", { name: /1\.2 小节/ }));
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
});
