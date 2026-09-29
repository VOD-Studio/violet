import { SegmentedArticleToc } from "@entities/post/ui/SegmentedArticleToc";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
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

	it("全部层级标题无需展开即可见", () => {
		const contentRef = createRef<HTMLElement>();
		render(<ArticleToc items={items} contentRef={contentRef} />);
		for (const item of items) {
			expect(screen.getByRole("link", { name: item.text })).toBeTruthy();
		}
		expect(screen.queryByRole("button", { name: "展开 第一章" })).toBeNull();
	});

	it("悬停展开目录与阅读进度，离开时退出交互", () => {
		render(
			<ArticleToc
				items={items}
				contentRef={createRef<HTMLElement>()}
				isRailCollapsedAtRest
			/>,
		);
		const shell = screen.getByRole("group", {
			name: "文章目录；悬停或聚焦以展开完整目录",
		});
		const panel = shell.querySelector("[data-toc-accordion]")?.parentElement;
		expect(panel?.hasAttribute("inert")).toBe(true);

		fireEvent.mouseEnter(shell);
		expect(panel?.hasAttribute("inert")).toBe(false);
		expect(screen.getByRole("progressbar", { name: "阅读进度" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "返回顶部" })).toBeNull();

		fireEvent.mouseLeave(shell);
		expect(panel?.hasAttribute("inert")).toBe(true);
	});

	it("键盘焦点从入口移动到目录条目时保持展开，离开后收起", () => {
		render(
			<ArticleToc
				items={items}
				contentRef={createRef<HTMLElement>()}
				isRailCollapsedAtRest
			/>,
		);
		const shell = screen.getByRole("group", {
			name: "文章目录；悬停或聚焦以展开完整目录",
		});
		const panel = shell.querySelector("[data-toc-accordion]")?.parentElement;
		const trigger = screen.getByRole("button", { name: "展开完整目录" });
		fireEvent.focus(trigger);
		expect(panel?.hasAttribute("inert")).toBe(false);
		const link = screen.getByRole("link", { name: "第一章" });

		fireEvent.blur(trigger, { relatedTarget: link });
		fireEvent.focus(link);
		expect(panel?.hasAttribute("inert")).toBe(false);

		fireEvent.blur(link, { relatedTarget: document.body });
		expect(panel?.hasAttribute("inert")).toBe(true);
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

describe("文章目录可见标题指示线", () => {
	it("在相邻标题之间逐帧跟随阅读位置，空档中也不断线", async () => {
		vi.stubGlobal("CSS", { escape: (value: string) => value });
		vi.stubGlobal("scrollY", 0);
		const nodes = [
			{ id: "first", title: "第一章" },
			{ id: "second", title: "第二章" },
			{ id: "third", title: "第三章" },
		];
		const body = document.createElement("article");
		const positions = [80, 400, 2000];
		for (const [index, node] of nodes.entries()) {
			const heading = document.createElement("h2");
			heading.id = node.id;
			vi.spyOn(heading, "getBoundingClientRect").mockImplementation(
				() => ({ top: positions[index] }) as DOMRect,
			);
			body.append(heading);
		}

		render(
			<SegmentedArticleToc
				nodes={nodes}
				activeId="first"
				onNavigate={vi.fn()}
				contentRef={{ current: body }}
				isRailCollapsedAtRest
			/>,
		);
		document.querySelectorAll("[data-toc-accordion] li").forEach((row, index) => {
			Object.defineProperty(row, "offsetTop", { value: index * 36 });
			Object.defineProperty(row, "offsetHeight", { value: 36 });
		});
		const indicator = () =>
			document.querySelector<HTMLElement>("[data-toc-accordion] ul > span");
		const position = () =>
			Number.parseFloat(indicator()?.style.transform.slice("translateY(".length) ?? "NaN");
		fireEvent.resize(window);
		await waitFor(() =>
			expect(Number.parseFloat(indicator()?.style.height ?? "0")).toBeGreaterThan(36),
		);
		const sameLine = indicator();
		const start = position();

		vi.stubGlobal("scrollY", 50);
		fireEvent.scroll(window);
		await waitFor(() => expect(position()).toBeGreaterThan(start));
		const next = position();
		expect(next).toBeLessThan(36);

		vi.stubGlobal("scrollY", 900);
		fireEvent.scroll(window);
		await waitFor(() => expect(position()).toBeGreaterThan(36));
		const gap = position();
		vi.stubGlobal("scrollY", 920);
		fireEvent.scroll(window);
		await waitFor(() => expect(position()).toBeGreaterThan(gap));
		expect(position() - gap).toBeLessThan(3);
		expect(indicator()).toBe(sameLine);
	});
});
