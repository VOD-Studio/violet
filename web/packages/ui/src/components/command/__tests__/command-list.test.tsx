import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CommandList, type CommandListProps } from "../command-list";
import { type CommandItem, matchCommands } from "../match";

const GROUPS = [
	{ id: "posts", label: "文章" },
	{ id: "pages", label: "页面" },
	{ id: "commands", label: "命令" },
	{ id: "fulltext", label: "全文" },
];

function items(onSelect = vi.fn()): CommandItem[] {
	return [
		{
			id: "cmd-theme",
			label: "切换主题",
			group: "commands",
			children: [
				{ id: "theme-spring", label: "花朝", group: "", onSelect },
				{ id: "theme-autumn", label: "桂月", group: "", onSelect },
			],
		},
		{
			id: "post-rust-4",
			label: "Rust 全栈笔记 · 第 4 章 · 实时推送",
			group: "posts",
			onSelect,
		},
		{ id: "page-blog", label: "博客", group: "pages", hint: "/blog", onSelect },
		{
			id: "post-rust-3",
			label: "Rust 全栈笔记 · 第 3 章 · 评论与批注",
			group: "posts",
			onSelect,
		},
		{ id: "cmd-new", label: "写文章", group: "commands", shortcut: ["mod", "N"], onSelect },
		{ id: "post-trust", label: "信任 rust 的理由", group: "posts", onSelect },
	];
}

describe("matchCommands", () => {
	it("组的顺序固定，组内标题开头就匹配的排前面，不区分大小写", () => {
		const sections = matchCommands(items(), GROUPS, "RUST");
		expect(sections.map(({ group }) => group.id)).toEqual(["posts"]);
		expect(sections[0].matches.map(({ item }) => item.id)).toEqual([
			"post-rust-4",
			"post-rust-3",
			"post-trust",
		]);
		expect(sections[0].matches[2].ranges).toEqual([[3, 7]]);
	});

	it("路径与关键词也参与匹配，但不在标题里加底色", () => {
		const [section] = matchCommands(items(), GROUPS, "/blog");
		expect(section.matches[0].item.id).toBe("page-blog");
		expect(section.matches[0].ranges).toEqual([]);
	});

	it("不输入时按分组顺序给出全部，每组最多 limit 项；调用方匹配过的结果总是显示", () => {
		const all = matchCommands(items(), GROUPS, "", 2);
		expect(all.map(({ group }) => group.id)).toEqual(["posts", "pages", "commands"]);
		expect(all[0].matches).toHaveLength(2);
		const withFullText = matchCommands(
			[...items(), { id: "ft-1", label: "推送的边界", group: "fulltext", filter: false }],
			GROUPS,
			"rust",
		);
		expect(withFullText.at(-1)?.matches[0].item.id).toBe("ft-1");
	});

	it("全文摘要按实际查询逐处匹配，保留大小写原文且不改变本地筛选范围", () => {
		const fullText: CommandItem = {
			id: "body",
			label: "正文里的命中",
			group: "fulltext",
			description: "先说 Rust，再说 RUST。",
			filter: false,
		};
		const [section] = matchCommands([fullText], GROUPS, " rust ");
		expect(section.matches[0].ranges).toEqual([]);
		expect(section.matches[0].descriptionRanges).toEqual([
			[3, 7],
			[11, 15],
		]);
		expect(matchCommands([{ ...fullText, filter: true }], GROUPS, "rust")).toEqual([]);
		expect(matchCommands([fullText], GROUPS, "")[0].matches[0].descriptionRanges).toEqual([]);
	});

	it("全文多关键词分别高亮，重叠词不重复输出同一段文字", () => {
		const [section] = matchCommands(
			[
				{
					id: "body",
					label: "编辑器手册",
					group: "fulltext",
					description: "设计之后渲染",
					filter: false,
				},
			],
			GROUPS,
			"设计 计 渲染 设计",
		);
		expect(section.matches[0].descriptionRanges).toEqual([
			[0, 2],
			[4, 6],
		]);
	});

	it("大小写转换扩展字符时，高亮区间仍指向原文", () => {
		const description = "İRust";
		const result = matchCommands(
			[{ id: "unicode", group: "fulltext", label: "正文", description, filter: false }],
			GROUPS,
			"Rust",
			5,
		);
		const match = result[0].matches[0];
		expect(
			match.descriptionRanges.map(([start, end]) => description.slice(start, end)),
		).toEqual(["Rust"]);
	});
});

function Palette(props: Partial<CommandListProps>) {
	const [open, setOpen] = useState(true);
	const [query, setQuery] = useState("");
	return (
		<CommandList
			open={open}
			onOpenChange={setOpen}
			items={items()}
			groups={GROUPS}
			fullTextGroup="fulltext"
			query={query}
			onQueryChange={setQuery}
			{...props}
		/>
	);
}

const input = () => screen.getByRole("combobox");
const active = () => document.getElementById(input().getAttribute("aria-activedescendant") ?? "");
const press = (key: string, init: Partial<KeyboardEventInit> = {}) =>
	fireEvent.keyDown(input(), { key, ...init });

describe("CommandList", () => {
	it("打开就聚焦输入框，当前项由 aria-activedescendant 指向", () => {
		render(<Palette />);
		expect(document.activeElement).toBe(input());
		expect(screen.getByRole("listbox")).toBeTruthy();
		expect(active()?.getAttribute("aria-selected")).toBe("true");
		expect(
			screen.getAllByRole("group").map((group) => group.getAttribute("aria-labelledby")),
		).not.toContain(null);
	});

	it("方向键跨过分组移动，到头循环", () => {
		render(<Palette />);
		const first = active()?.textContent;
		press("ArrowUp");
		expect(active()?.textContent).toContain("写文章");
		press("ArrowDown");
		expect(active()?.textContent).toBe(first);
		press("ArrowDown");
		press("ArrowDown");
		press("ArrowDown");
		expect(active()?.textContent).toContain("博客");
	});

	it("标题与靠后的全文摘要命中同时高亮，摘要中的 HTML 保持纯文本", () => {
		const description = `${"正文前置说明。".repeat(12)}已定设计 <img src=x onerror=alert(1)> 设计。`;
		render(
			<Palette
				query="设计"
				items={[
					{
						id: "body",
						group: "fulltext",
						label: "设计手记",
						description,
						filter: false,
					},
				]}
			/>,
		);
		const option = screen.getByRole("option");
		expect(option.textContent).toBe(`设计手记${description}`);
		expect([...option.querySelectorAll("mark")].map((mark) => mark.textContent)).toEqual([
			"设计",
			"设计",
			"设计",
		]);
		expect(option.querySelector("img")).toBeNull();
	});

	it("无结果时安全呈现查询，不留下活动项或额外 Tab 停靠位", () => {
		const query = `${"abcdefgh".repeat(100)}<img src=x onerror=alert(1)>`;
		render(<Palette query={query} />);
		const status = screen.getByRole("status");
		expect(status.textContent).toContain(query);
		expect(status.querySelector("img")).toBeNull();
		expect(screen.queryByRole("option")).toBeNull();
		expect(input().hasAttribute("aria-activedescendant")).toBe(false);
		expect(screen.getByRole("listbox").tabIndex).toBe(-1);
		press("ArrowDown");
		expect(document.activeElement).toBe(input());
	});

	it("回车时当前项亮一下再执行并收起，⌘↵ 在新标签页打开", async () => {
		const onSelect = vi.fn();
		render(<Palette items={items(onSelect)} />);
		press("Enter", { metaKey: true });
		expect(active()?.hasAttribute("data-flash")).toBe(true);
		await waitFor(() => expect(onSelect).toHaveBeenCalledWith({ newTab: true }));
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("进入子页面后输入框左边显示层级，空输入时退格回到上一级", () => {
		render(<Palette />);
		fireEvent.change(input(), { target: { value: "主题" } });
		press("Enter");
		expect(screen.getByRole("button", { name: "切换主题" })).toBeTruthy();
		expect((input() as HTMLInputElement).value).toBe("");
		expect(screen.getByRole("option", { name: "花朝" })).toBeTruthy();
		press("Backspace");
		expect(screen.queryByRole("button", { name: "切换主题" })).toBeNull();
	});

	it("Esc 有输入时先清空，在子页面时回到上一级，都没有时关闭", () => {
		render(<Palette />);
		fireEvent.change(input(), { target: { value: "主题" } });
		press("Escape");
		expect((input() as HTMLInputElement).value).toBe("");
		fireEvent.change(input(), { target: { value: "主题" } });
		press("Enter");
		press("Escape");
		expect(screen.queryByRole("button", { name: "切换主题" })).toBeNull();
		press("Escape");
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("全文搜索中列表立即标为忙碌，200ms 后输入框右侧转圈、全文那组显示骨架", async () => {
		render(<Palette searching />);
		fireEvent.change(input(), { target: { value: "推送" } });
		expect(screen.getByRole("listbox").getAttribute("aria-busy")).toBe("true");
		expect(screen.queryByLabelText("正在搜索全文")).toBeNull();
		expect(await screen.findByLabelText("正在搜索全文")).toBeTruthy();
		expect(
			screen.getByRole("group", { name: "全文" }).querySelector(".v-command__skeleton"),
		).toBeTruthy();
	});

	it("没有结果时给出唯一一项「在全文里搜索」，回车即可", () => {
		const onSearchAll = vi.fn();
		render(<Palette onSearchAll={onSearchAll} />);
		fireEvent.change(input(), { target: { value: "桂花酿" } });
		press("Enter");
		expect(onSearchAll).toHaveBeenCalledWith("桂花酿");
	});

	it("只有指针真的移动时才改当前项", () => {
		render(<Palette />);
		const blog = screen.getByRole("option", { name: /博客/ });
		fireEvent.pointerEnter(blog);
		expect(active()).not.toBe(blog);
		fireEvent.pointerMove(blog);
		expect(active()).toBe(blog);
	});

	it("关闭后焦点回到打开前的位置", async () => {
		function WithOpener() {
			const [open, setOpen] = useState(false);
			const [query, setQuery] = useState("");
			return (
				<>
					<button type="button" onClick={() => setOpen(true)}>
						搜索
					</button>
					<CommandList
						open={open}
						onOpenChange={setOpen}
						items={items()}
						groups={GROUPS}
						query={query}
						onQueryChange={setQuery}
					/>
				</>
			);
		}
		render(<WithOpener />);
		const opener = screen.getByRole("button", { name: "搜索" });
		opener.focus();
		fireEvent.click(opener);
		press("Escape");
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
		await waitFor(() => expect(document.activeElement).toBe(opener));
	});
});
