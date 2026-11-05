import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ContextMenu,
	ContextMenuCheckboxItem,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuRadioGroup,
	ContextMenuRadioItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuTrigger,
} from "../context-menu";

interface FixtureProps {
	onEdit?: () => void;
	onSeries?: (name: string) => void;
	container?: HTMLElement | null;
}

/** 稿里的右键菜单：在文章那一行上点右键，与 ⋯ 菜单是同一套项。 */
function Fixture({ onEdit, onSeries, container }: FixtureProps) {
	const [sort, setSort] = useState("latest");
	const [summary, setSummary] = useState(true);
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<article data-testid="row">一篇文章</article>
			</ContextMenuTrigger>
			<ContextMenuContent aria-label="文章操作" container={container}>
				<ContextMenuItem onSelect={onEdit}>
					编辑
					<ContextMenuShortcut>E</ContextMenuShortcut>
				</ContextMenuItem>
				<ContextMenuItem>复制链接</ContextMenuItem>
				<ContextMenuSub>
					<ContextMenuSubTrigger>移动到系列</ContextMenuSubTrigger>
					<ContextMenuSubContent>
						<ContextMenuItem onSelect={() => onSeries?.("前端")}>前端</ContextMenuItem>
					</ContextMenuSubContent>
				</ContextMenuSub>
				<ContextMenuItem disabled reason="草稿不能置顶">
					置顶
				</ContextMenuItem>
				<ContextMenuSeparator />
				<ContextMenuLabel>排序</ContextMenuLabel>
				<ContextMenuRadioGroup value={sort} onValueChange={setSort}>
					<ContextMenuRadioItem value="latest">最新</ContextMenuRadioItem>
					<ContextMenuRadioItem value="views">浏览最多</ContextMenuRadioItem>
				</ContextMenuRadioGroup>
				<ContextMenuCheckboxItem checked={summary} onCheckedChange={setSummary}>
					显示摘要
				</ContextMenuCheckboxItem>
				<ContextMenuItem variant="destructive">移到回收站</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
}

const row = () => screen.getByTestId("row");
const menu = () => screen.queryByRole("menu");
const flush = () => act(() => vi.advanceTimersByTime(0));
const rightClick = () => {
	fireEvent.contextMenu(row(), { clientX: 120, clientY: 80 });
	flush();
};
const press = (key: string) => {
	fireEvent.keyDown(document.activeElement ?? document.body, { key });
	flush();
};
const item = (name: string | RegExp) => screen.getByRole("menuitem", { name });

describe("ContextMenu", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("右键打开：面板是 menu，项按类型带 role 与 aria-checked", () => {
		render(<Fixture />);
		expect(menu()).toBeNull();
		rightClick();

		expect(menu()?.getAttribute("aria-label")).toBe("文章操作");
		expect(screen.getAllByRole("menuitem").map((el) => el.textContent)).toEqual([
			"编辑E",
			"复制链接",
			"移动到系列",
			"置顶草稿不能置顶",
			"移到回收站",
		]);
		expect(
			screen.getByRole("menuitemradio", { name: "最新" }).getAttribute("aria-checked"),
		).toBe("true");
		expect(
			screen.getByRole("menuitemcheckbox", { name: "显示摘要" }).getAttribute("aria-checked"),
		).toBe("true");
		expect(item(/置顶/).getAttribute("aria-disabled")).toBe("true");
	});

	it("被右键的元素在菜单打开期间带 data-state=open，收起后还原", () => {
		render(<Fixture />);
		expect(row().getAttribute("data-state")).toBe("closed");
		rightClick();
		expect(row().getAttribute("data-state")).toBe("open");

		press("Escape");
		expect(menu()).toBeNull();
		expect(row().getAttribute("data-state")).toBe("closed");
	});

	it("Esc 与点击外部关闭", () => {
		render(<Fixture />);
		rightClick();
		press("Escape");
		expect(menu()).toBeNull();

		rightClick();
		fireEvent.pointerDown(document.body, { pointerType: "mouse" });
		flush();
		expect(menu()).toBeNull();
	});

	it("普通项执行后收起，单选项选中后收起，多选项点了不收起", () => {
		const onEdit = vi.fn();
		render(<Fixture onEdit={onEdit} />);

		rightClick();
		fireEvent.click(item(/^编辑/));
		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(menu()).toBeNull();

		rightClick();
		const summary = screen.getByRole("menuitemcheckbox", { name: "显示摘要" });
		fireEvent.click(summary);
		expect(summary.getAttribute("aria-checked")).toBe("false");
		expect(menu()).not.toBeNull();

		fireEvent.click(screen.getByRole("menuitemradio", { name: "浏览最多" }));
		expect(menu()).toBeNull();
	});

	it("↑↓ 循环、Home/End，不可用项被跳过", () => {
		render(<Fixture />);
		rightClick();
		press("ArrowDown");
		expect(document.activeElement).toBe(item(/^编辑/));
		press("End");
		expect(document.activeElement).toBe(item("移到回收站"));
		press("ArrowDown");
		expect(document.activeElement).toBe(item(/^编辑/));
		press("ArrowUp");
		expect(document.activeElement).toBe(item("移到回收站"));
		press("Home");
		press("ArrowDown");
		press("ArrowDown");
		press("ArrowDown");
		// 「置顶」不可用，跳到单选项
		expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "最新" }));
	});

	it("输入字母按拼音首字母跳转：B 编辑、F 复制链接", () => {
		render(<Fixture />);
		rightClick();
		press("ArrowDown");
		press("ArrowDown");
		press("b");
		expect(document.activeElement).toBe(item(/^编辑/));
		act(() => vi.advanceTimersByTime(1000));
		press("f");
		expect(document.activeElement).toBe(item("复制链接"));
	});

	it("子菜单：悬停 100ms 打开，Esc 只收起子菜单，选了其中的项整个菜单收起", () => {
		const onSeries = vi.fn();
		render(<Fixture onSeries={onSeries} />);
		rightClick();
		const trigger = item("移动到系列");

		fireEvent.pointerMove(trigger, { pointerType: "mouse" });
		act(() => vi.advanceTimersByTime(99));
		expect(screen.queryByRole("menu", { name: "移动到系列" })).toBeNull();
		act(() => vi.advanceTimersByTime(1));
		expect(screen.queryByRole("menu", { name: "移动到系列" })).not.toBeNull();

		act(() => trigger.focus());
		press("Escape");
		expect(screen.queryByRole("menu", { name: "移动到系列" })).toBeNull();
		expect(menu()).not.toBeNull();
		expect(document.activeElement).toBe(trigger);

		fireEvent.pointerMove(trigger, { pointerType: "mouse" });
		act(() => vi.advanceTimersByTime(100));
		fireEvent.click(screen.getByRole("menuitem", { name: "前端" }));
		expect(onSeries).toHaveBeenCalledWith("前端");
		expect(menu()).toBeNull();
	});

	it("container 把面板挂进指定元素", () => {
		const host = document.createElement("div");
		document.body.append(host);
		render(<Fixture container={host} />);
		rightClick();
		expect(host.contains(menu())).toBe(true);
		host.remove();
	});
});
