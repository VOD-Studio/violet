import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dropdown, DropdownContent, DropdownGroup, DropdownTrigger } from "../dropdown";

function Menu({
	label,
	...props
}: { label: string } & Omit<ComponentProps<typeof Dropdown>, "children">) {
	return (
		<Dropdown {...props}>
			<DropdownTrigger asChild>
				<a href={`#${label}`}>{label}</a>
			</DropdownTrigger>
			<DropdownContent aria-label={`${label}菜单`}>
				<a href={`#${label}-1`}>{label}一</a>
				<a href={`#${label}-2`}>{label}二</a>
			</DropdownContent>
		</Dropdown>
	);
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const hover = (element: Element) => fireEvent.pointerEnter(element, { pointerType: "mouse" });
const unhover = (element: Element) => fireEvent.pointerLeave(element, { pointerType: "mouse" });
const panel = (label: string) => screen.queryByLabelText(`${label}菜单`);
/** jsdom 不实现 :focus-visible 的输入模态，按需替身以区分键盘与点按聚焦。 */
const focusAs = (element: HTMLElement, modality: "keyboard" | "pointer") => {
	const matches = element.matches.bind(element);
	vi.spyOn(element, "matches").mockImplementation((selector) =>
		selector === ":focus-visible" ? modality === "keyboard" : matches(selector),
	);
	act(() => element.focus());
};

describe("Dropdown", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("悬停等待 openDelay 后展开，离开经 closeDelay 后收起", () => {
		render(<Menu label="博客" />);
		const trigger = screen.getByRole("link", { name: "博客" });

		hover(trigger);
		advance(79);
		expect(panel("博客")).toBeNull();
		advance(1);
		expect(panel("博客")).not.toBeNull();
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(trigger.getAttribute("aria-controls")).toBe(panel("博客")?.id);

		unhover(trigger);
		advance(139);
		expect(panel("博客")).not.toBeNull();
		advance(1);
		expect(panel("博客")).toBeNull();
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
	});

	it("指针坐标仍在触发器内的 leave（如页面转场快照层截走指针）不收起，坐标已在外面才收起", () => {
		render(<Menu label="博客" />);
		const trigger = screen.getByRole("link", { name: "博客" });
		vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 40, 80, 32));
		hover(trigger);
		advance(80);

		fireEvent.pointerLeave(trigger, { pointerType: "mouse", clientX: 140, clientY: 56 });
		advance(500);
		expect(panel("博客")).not.toBeNull();

		fireEvent.pointerLeave(trigger, { pointerType: "mouse", clientX: 140, clientY: 120 });
		advance(140);
		expect(panel("博客")).toBeNull();
	});

	it("leave 被忽略后不会再有对应事件：指针之后移出安全区仍会收起", () => {
		render(<Menu label="博客" />);
		const trigger = screen.getByRole("link", { name: "博客" });
		vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 40, 80, 32));
		hover(trigger);
		advance(80);

		fireEvent.pointerLeave(trigger, { pointerType: "mouse", clientX: 140, clientY: 56 });
		fireEvent.pointerMove(document, { pointerType: "mouse", clientX: 142, clientY: 57 });
		advance(500);
		expect(panel("博客")).not.toBeNull();

		fireEvent.pointerMove(document, { pointerType: "mouse", clientX: 400, clientY: 300 });
		advance(139);
		expect(panel("博客")).not.toBeNull();
		advance(1);
		expect(panel("博客")).toBeNull();
	});

	it("触发器与面板之间的间隙属于安全区，移出间隙才收起", () => {
		render(<Menu label="博客" />);
		const trigger = screen.getByRole("link", { name: "博客" });
		vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 40, 80, 32));
		hover(trigger);
		advance(80);
		vi.spyOn(panel("博客") as HTMLElement, "getBoundingClientRect").mockReturnValue(
			new DOMRect(60, 82, 200, 100),
		);

		fireEvent.pointerMove(document, { pointerType: "mouse", clientX: 150, clientY: 77 });
		advance(500);
		expect(panel("博客")).not.toBeNull();

		fireEvent.pointerMove(document, { pointerType: "mouse", clientX: 330, clientY: 77 });
		advance(140);
		expect(panel("博客")).toBeNull();
	});

	it("指针从触发器移进面板不会收起，离开面板后才收起", () => {
		render(<Menu label="博客" />);
		const trigger = screen.getByRole("link", { name: "博客" });
		hover(trigger);
		advance(80);

		unhover(trigger);
		advance(100);
		hover(panel("博客") as HTMLElement);
		advance(500);
		expect(panel("博客")).not.toBeNull();

		unhover(panel("博客") as HTMLElement);
		advance(140);
		expect(panel("博客")).toBeNull();
	});

	it("点击不参与开合：关闭时点击不展开，展开后点击触发器或面板内容不收起", () => {
		render(<Menu label="博客" />);
		const trigger = screen.getByRole("link", { name: "博客" });

		fireEvent.click(trigger);
		advance(500);
		expect(panel("博客")).toBeNull();

		hover(trigger);
		advance(80);
		fireEvent.click(trigger);
		fireEvent.click(screen.getByRole("link", { name: "博客一" }));
		advance(500);
		expect(panel("博客")).not.toBeNull();
	});

	it("组内移动到另一个菜单时立即展开并收起前一个", () => {
		render(
			<DropdownGroup>
				<Menu label="博客" />
				<Menu label="更多" />
			</DropdownGroup>,
		);
		const blog = screen.getByRole("link", { name: "博客" });
		const more = screen.getByRole("link", { name: "更多" });
		hover(blog);
		advance(80);
		expect(panel("博客")?.getAttribute("data-motion")).toBe("reveal");
		unhover(blog);
		advance(30);

		hover(more);
		advance(0);
		expect(panel("更多")).not.toBeNull();
		expect(panel("更多")?.getAttribute("data-motion")).toBe("morph");
		expect(panel("博客")).toBeNull();
	});

	it("组内来回快速切换时同一时刻只有一块面板，折返的面板同样接力展开", () => {
		render(
			<DropdownGroup>
				<Menu label="博客" />
				<Menu label="更多" />
			</DropdownGroup>,
		);
		const blog = screen.getByRole("link", { name: "博客" });
		const more = screen.getByRole("link", { name: "更多" });
		const openPanels = () => document.querySelectorAll('[data-slot="dropdown-content"]').length;

		hover(blog);
		advance(80);
		for (const [from, to] of [
			[blog, more],
			[more, blog],
			[blog, more],
			[more, blog],
		]) {
			unhover(from);
			hover(to);
			advance(0);
			expect(openPanels()).toBe(1);
		}
		expect(panel("博客")?.getAttribute("data-motion")).toBe("morph");
		expect(panel("更多")).toBeNull();
	});

	it("组内全部收起后一段时间内再次进入仍免去延迟，超过则恢复延迟", () => {
		render(
			<DropdownGroup skipDelay={400}>
				<Menu label="博客" />
			</DropdownGroup>,
		);
		const blog = screen.getByRole("link", { name: "博客" });
		hover(blog);
		advance(80);
		unhover(blog);
		advance(140);
		expect(panel("博客")).toBeNull();

		hover(blog);
		advance(0);
		expect(panel("博客")).not.toBeNull();

		unhover(blog);
		advance(140);
		advance(401);
		hover(blog);
		advance(79);
		expect(panel("博客")).toBeNull();
		advance(1);
		expect(panel("博客")).not.toBeNull();
	});

	it("独立菜单没有组预热，每次都等待 openDelay", () => {
		render(
			<>
				<Menu label="博客" />
				<Menu label="更多" />
			</>,
		);
		const blog = screen.getByRole("link", { name: "博客" });
		hover(blog);
		advance(80);
		unhover(blog);
		hover(screen.getByRole("link", { name: "更多" }));
		advance(79);
		expect(panel("更多")).toBeNull();
	});

	it("触屏指针没有悬停，不展开", () => {
		render(<Menu label="博客" />);
		fireEvent.pointerEnter(screen.getByRole("link", { name: "博客" }), {
			pointerType: "touch",
		});
		advance(500);
		expect(panel("博客")).toBeNull();
	});

	it("点按聚焦不展开：只有键盘聚焦才展开", () => {
		render(<Menu label="博客" />);
		const trigger = screen.getByRole("link", { name: "博客" });
		focusAs(trigger, "pointer");
		advance(500);
		expect(panel("博客")).toBeNull();
	});

	it("键盘聚焦立即展开；焦点进入面板不收起，移出到别处收起", () => {
		render(
			<>
				<Menu label="博客" />
				<button type="button">别处</button>
			</>,
		);
		const trigger = screen.getByRole("link", { name: "博客" });
		focusAs(trigger, "keyboard");
		expect(panel("博客")).not.toBeNull();

		const first = screen.getByRole("link", { name: "博客一" });
		act(() => first.focus());
		advance(500);
		expect(panel("博客")).not.toBeNull();

		act(() => screen.getByRole("button", { name: "别处" }).focus());
		expect(panel("博客")).toBeNull();
	});

	it("Escape 收起并把面板内的焦点交回触发器，且不会因焦点回到触发器而重新展开", () => {
		render(<Menu label="博客" />);
		const trigger = screen.getByRole("link", { name: "博客" });
		focusAs(trigger, "keyboard");
		act(() => screen.getByRole("link", { name: "博客一" }).focus());

		fireEvent.keyDown(document, { key: "Escape" });
		expect(panel("博客")).toBeNull();
		expect(document.activeElement).toBe(trigger);
		advance(500);
		expect(panel("博客")).toBeNull();
	});

	it("Escape 后指针需先离开再进入才会重新展开", () => {
		render(<Menu label="博客" />);
		const trigger = screen.getByRole("link", { name: "博客" });
		hover(trigger);
		advance(80);
		fireEvent.keyDown(document, { key: "Escape" });
		expect(panel("博客")).toBeNull();

		hover(trigger);
		advance(500);
		expect(panel("博客")).toBeNull();

		unhover(trigger);
		advance(140);
		hover(trigger);
		advance(80);
		expect(panel("博客")).not.toBeNull();
	});

	it("受控 open 只请求变化，由宿主决定是否展开", () => {
		const onOpenChange = vi.fn();
		function Controlled() {
			const [open, setOpen] = useState(false);
			return (
				<Menu
					label="博客"
					open={open}
					onOpenChange={(next) => {
						onOpenChange(next);
						if (next) setOpen(true);
					}}
				/>
			);
		}
		render(<Controlled />);
		hover(screen.getByRole("link", { name: "博客" }));
		advance(80);
		expect(onOpenChange).toHaveBeenCalledWith(true);
		expect(panel("博客")).not.toBeNull();

		unhover(screen.getByRole("link", { name: "博客" }));
		advance(140);
		expect(onOpenChange).toHaveBeenLastCalledWith(false);
		expect(panel("博客")).not.toBeNull();
	});

	it("asChild 保留链接自身属性与事件，原生模式是 type=button 的按钮", () => {
		const onClick = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
		render(
			<>
				<Dropdown>
					<DropdownTrigger asChild>
						<a href="/blog" onClick={onClick}>
							博客
						</a>
					</DropdownTrigger>
				</Dropdown>
				<Dropdown>
					<DropdownTrigger>更多</DropdownTrigger>
				</Dropdown>
			</>,
		);
		const link = screen.getByRole("link", { name: "博客" });
		expect(link.getAttribute("href")).toBe("/blog");
		fireEvent.click(link);
		expect(onClick).toHaveBeenCalledOnce();
		expect(screen.getByRole("button", { name: "更多" }).getAttribute("type")).toBe("button");
	});

	it("服务端渲染只输出触发器，面板在展开后才存在", () => {
		const html = renderToString(<Menu label="博客" />);
		expect(html).toContain('aria-expanded="false"');
		expect(html).not.toContain("博客一");
	});
});
