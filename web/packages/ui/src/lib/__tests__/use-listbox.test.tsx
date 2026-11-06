import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { type ListboxItem, type UseListboxOptions, useListbox } from "../use-listbox";

const FRUITS: ListboxItem[] = [
	{ id: "apple", textValue: "Apple" },
	{ id: "avocado", textValue: "Avocado" },
	{ id: "banana", textValue: "Banana", disabled: true },
	{ id: "cherry", textValue: "Cherry" },
	{ id: "date", textValue: "Date" },
];

type HarnessProps = Partial<UseListboxOptions> & { selected?: string };

function Harness({ items = FRUITS, open = true, selected, ...options }: HarnessProps) {
	const listbox = useListbox({ items, open, ...options });
	return (
		<>
			<div
				role="combobox"
				aria-expanded={open}
				aria-controls="list"
				aria-activedescendant={listbox.activeId}
				tabIndex={0}
				data-mode={listbox.mode}
				data-index={listbox.activeIndex}
				onKeyDown={(event) => {
					if (listbox.handleKeyDown(event)) event.preventDefault();
				}}
			/>
			<div id="list" role="listbox">
				{items.map((item, index) => (
					<div
						key={item.id}
						{...listbox.getItemProps(index, { selected: item.id === selected })}
						ref={(element) => listbox.registerItem(item.id, element)}
					>
						{item.textValue}
					</div>
				))}
			</div>
		</>
	);
}

const box = () => screen.getByRole("combobox");
const press = (key: string) => fireEvent.keyDown(box(), { key });
const active = () => box().getAttribute("aria-activedescendant");
const scrollIntoView = () => Element.prototype.scrollIntoView as Mock;

describe("useListbox", () => {
	beforeEach(() => scrollIntoView().mockClear());
	afterEach(() => vi.useRealTimers());

	it("没有默认项时展开后无高亮，↓ 到第一项，↑ 到最后一项", () => {
		const { unmount } = render(<Harness />);
		expect(active()).toBeNull();
		press("ArrowDown");
		expect(active()).toBe("apple");
		unmount();

		render(<Harness />);
		press("ArrowUp");
		expect(active()).toBe("date");
	});

	it("↑ ↓ 跳过禁用项，到头停住不循环", () => {
		render(<Harness />);
		press("ArrowDown");
		press("ArrowDown");
		expect(active()).toBe("avocado");
		press("ArrowDown");
		expect(active()).toBe("cherry");
		press("ArrowDown");
		press("ArrowDown");
		expect(active()).toBe("date");
		press("ArrowUp");
		press("ArrowUp");
		press("ArrowUp");
		press("ArrowUp");
		expect(active()).toBe("apple");
	});

	it("loop 时到头循环", () => {
		render(<Harness loop />);
		press("ArrowUp");
		expect(active()).toBe("date");
		press("ArrowDown");
		expect(active()).toBe("apple");
	});

	it("Home 与 End 到首尾，PageDown 与 PageUp 一次移动 8 项并停在边界", () => {
		render(<Harness />);
		press("End");
		expect(active()).toBe("date");
		press("Home");
		expect(active()).toBe("apple");
		press("PageDown");
		expect(active()).toBe("date");
		press("PageUp");
		expect(active()).toBe("apple");
	});

	it("pageSize 决定翻页的步长", () => {
		render(<Harness pageSize={2} />);
		press("Home");
		press("PageDown");
		// 可用项依次为 apple、avocado、cherry、date：移动 2 项到 cherry
		expect(active()).toBe("cherry");
	});

	it("按键被处理时返回 true，未展开或无关按键返回 false", () => {
		const handled: boolean[] = [];
		function Probe({ open }: { open: boolean }) {
			const listbox = useListbox({ items: FRUITS, open });
			return (
				<div
					role="combobox"
					aria-expanded={open}
					tabIndex={0}
					onKeyDown={(event) => handled.push(listbox.handleKeyDown(event))}
				/>
			);
		}
		const { rerender } = render(<Probe open={false} />);
		press("ArrowDown");
		rerender(<Probe open />);
		press("ArrowDown");
		press("Enter");
		press("x");
		expect(handled).toEqual([false, true, false, false]);
	});

	it("initialActiveId 决定展开时的高亮，被禁用或不存在时按 activateFirst 处理", () => {
		const { rerender } = render(<Harness initialActiveId="cherry" />);
		expect(active()).toBe("cherry");
		rerender(<Harness initialActiveId="banana" />);
		expect(active()).toBeNull();
		rerender(<Harness initialActiveId="banana" activateFirst />);
		expect(active()).toBe("apple");
		rerender(<Harness initialActiveId="missing" />);
		expect(active()).toBeNull();
	});

	it("收起后高亮复位，重新展开回到初始项", () => {
		const { rerender } = render(<Harness initialActiveId="cherry" />);
		press("ArrowDown");
		expect(active()).toBe("date");
		rerender(<Harness open={false} initialActiveId="cherry" />);
		expect(active()).toBeNull();
		rerender(<Harness initialActiveId="cherry" />);
		expect(active()).toBe("cherry");
	});

	it("setActiveIndex 小于 0 清空高亮，不会回到默认项", () => {
		function Clearable() {
			const listbox = useListbox({ items: FRUITS, open: true, activateFirst: true });
			return (
				<>
					<span role="status">{String(listbox.activeId)}</span>
					<button type="button" onClick={() => listbox.setActiveIndex(-1)}>
						清空
					</button>
				</>
			);
		}
		render(<Clearable />);
		expect(screen.getByRole("status").textContent).toBe("apple");
		fireEvent.click(screen.getByRole("button", { name: "清空" }));
		expect(screen.getByRole("status").textContent).toBe("undefined");
	});

	it("高亮跟着 id 走：选项被筛掉后不会指向别的行", () => {
		const { rerender } = render(<Harness />);
		press("End");
		expect(active()).toBe("date");
		rerender(<Harness items={FRUITS.slice(0, 3)} />);
		expect(active()).toBeNull();
		rerender(<Harness items={[FRUITS[4], ...FRUITS.slice(0, 3)]} />);
		expect(active()).toBe("date");
		expect(box().getAttribute("data-index")).toBe("0");
	});

	it("onActiveChange 在高亮项变化时调用，收起时报告 null", () => {
		const onActiveChange = vi.fn();
		const { rerender } = render(<Harness onActiveChange={onActiveChange} />);
		press("ArrowDown");
		expect(onActiveChange).toHaveBeenLastCalledWith(FRUITS[0], 0);
		press("ArrowDown");
		expect(onActiveChange).toHaveBeenLastCalledWith(FRUITS[1], 1);
		rerender(<Harness open={false} onActiveChange={onActiveChange} />);
		expect(onActiveChange).toHaveBeenLastCalledWith(null, -1);
	});

	describe("前缀预测输入", () => {
		it("默认关闭，开启后按前缀匹配并跳过禁用项", () => {
			const { unmount } = render(<Harness />);
			expect(fireEvent.keyDown(box(), { key: "c" })).toBe(true);
			expect(active()).toBeNull();
			unmount();

			render(<Harness typeahead />);
			vi.useFakeTimers();
			press("b");
			// Banana 被禁用，不能成为目标，也没有别的 b 开头的项
			expect(active()).toBeNull();
			act(() => {
				vi.advanceTimersByTime(500);
			});
			press("c");
			expect(active()).toBe("cherry");
		});

		it("连续输入组成更长的前缀，500ms 后缓冲清空", () => {
			vi.useFakeTimers();
			render(<Harness typeahead />);
			press("a");
			expect(active()).toBe("apple");
			press("v");
			press("o");
			expect(active()).toBe("avocado");
			act(() => {
				vi.advanceTimersByTime(499);
			});
			press("d");
			// 缓冲还在：avod 没有匹配，高亮不变
			expect(active()).toBe("avocado");
			act(() => {
				vi.advanceTimersByTime(500);
			});
			press("d");
			expect(active()).toBe("date");
		});

		it("同一个字母连按在同首字母的项之间轮换", () => {
			render(<Harness typeahead initialActiveId="apple" />);
			press("a");
			expect(active()).toBe("avocado");
			press("a");
			expect(active()).toBe("apple");
		});

		it("汉字标签按拼音声母匹配，大小写不敏感", () => {
			const items = [
				{ id: "draft", textValue: "草稿" },
				{ id: "published", textValue: "已发布" },
				{ id: "archived", textValue: "已归档" },
			];
			render(<Harness items={items} typeahead />);
			press("Y");
			expect(active()).toBe("published");
			// 缓冲是 yg，只有已归档（y g d）的声母以它开头
			press("g");
			expect(active()).toBe("archived");
		});

		it("缓冲为空时空格不算预测输入，有缓冲时算", () => {
			const items = [
				{ id: "new", textValue: "new york" },
				{ id: "newark", textValue: "newark" },
			];
			render(<Harness items={items} typeahead />);
			expect(fireEvent.keyDown(box(), { key: " " })).toBe(true);
			expect(active()).toBeNull();
			press("n");
			press("e");
			press("w");
			press(" ");
			expect(active()).toBe("new");
		});

		it("带修饰键的组合不处理", () => {
			render(<Harness typeahead />);
			fireEvent.keyDown(box(), { key: "c", metaKey: true });
			fireEvent.keyDown(box(), { key: "c", ctrlKey: true });
			expect(active()).toBeNull();
		});
	});

	describe("选项属性与模式", () => {
		it("给选项 id、role、aria-selected、aria-disabled 与 data-active", () => {
			render(<Harness selected="cherry" />);
			const options = screen.getAllByRole("option", { hidden: true });
			expect(options.map((option) => option.id)).toEqual(FRUITS.map((item) => item.id));
			expect(options[3].getAttribute("aria-selected")).toBe("true");
			expect(options[0].getAttribute("aria-selected")).toBe("false");
			expect(options[2].getAttribute("aria-disabled")).toBe("true");
			expect(options[0].getAttribute("aria-disabled")).toBeNull();
			press("ArrowDown");
			expect(options[0].hasAttribute("data-active")).toBe(true);
		});

		it('selectedFor 为 "active" 时 aria-selected 表示高亮项', () => {
			render(<Harness selectedFor="active" selected="cherry" />);
			press("ArrowDown");
			const options = screen.getAllByRole("option", { hidden: true });
			expect(options[0].getAttribute("aria-selected")).toBe("true");
			expect(options[3].getAttribute("aria-selected")).toBe("false");
		});

		it("键盘操作置键盘模式并给 data-kb，指针移动置回指针模式并去掉 data-kb", () => {
			render(<Harness />);
			const options = screen.getAllByRole("option", { hidden: true });
			press("ArrowDown");
			expect(box().getAttribute("data-mode")).toBe("keyboard");
			expect(options[0].hasAttribute("data-kb")).toBe(true);
			fireEvent.pointerMove(options[1], { clientX: 10, clientY: 10 });
			expect(box().getAttribute("data-mode")).toBe("pointer");
			expect(active()).toBe("avocado");
			expect(options[1].hasAttribute("data-active")).toBe(true);
			expect(options[1].hasAttribute("data-kb")).toBe(false);
		});

		it("指针移到禁用项不高亮，坐标没变的补发移动也不算", () => {
			render(<Harness />);
			const options = screen.getAllByRole("option", { hidden: true });
			fireEvent.pointerMove(options[2], { clientX: 5, clientY: 5 });
			expect(active()).toBeNull();
			fireEvent.pointerMove(options[0], { clientX: 20, clientY: 20 });
			expect(active()).toBe("apple");
			press("ArrowDown");
			expect(active()).toBe("avocado");
			// 键盘滚动后浏览器在原坐标补发移动：不能把高亮抢回去
			fireEvent.pointerMove(options[0], { clientX: 20, clientY: 20 });
			expect(active()).toBe("avocado");
			fireEvent.pointerMove(options[0], { clientX: 21, clientY: 20 });
			expect(active()).toBe("apple");
		});
	});

	it("同一个 id 因重排换了下标，onActiveChange 用新下标重新报告", () => {
		const onActiveChange = vi.fn();
		const { rerender } = render(<Harness onActiveChange={onActiveChange} />);
		press("End");
		expect(onActiveChange).toHaveBeenLastCalledWith(FRUITS[4], 4);
		const reordered = [FRUITS[4], ...FRUITS.slice(0, 4)];
		rerender(<Harness items={reordered} onActiveChange={onActiveChange} />);
		expect(onActiveChange).toHaveBeenLastCalledWith(FRUITS[4], 0);
	});

	describe("滚动", () => {
		it("已在末项再按 End 不留下待滚动标记，之后指针移动不滚动", () => {
			render(<Harness />);
			const options = screen.getAllByRole("option", { hidden: true });
			press("End");
			expect(scrollIntoView()).toHaveBeenCalledTimes(1);
			press("End");
			scrollIntoView().mockClear();
			fireEvent.pointerMove(options[1], { clientX: 3, clientY: 3 });
			expect(active()).toBe("avocado");
			expect(scrollIntoView()).not.toHaveBeenCalled();
		});

		it("键盘移动后把高亮行滚进可视区", () => {
			render(<Harness />);
			press("ArrowDown");
			expect(scrollIntoView()).toHaveBeenCalledTimes(1);
			expect(scrollIntoView()).toHaveBeenCalledWith({ block: "nearest" });
		});

		it("指针引起的变化不滚动", () => {
			render(<Harness />);
			const options = screen.getAllByRole("option", { hidden: true });
			fireEvent.pointerMove(options[1], { clientX: 1, clientY: 1 });
			fireEvent.pointerMove(options[3], { clientX: 2, clientY: 2 });
			expect(scrollIntoView()).not.toHaveBeenCalled();
		});

		it("展开时的默认高亮不滚动，由调用方在面板定位后主动滚", () => {
			function Manual() {
				const listbox = useListbox({ items: FRUITS, open: true, initialActiveId: "date" });
				return (
					<>
						<div id="date" ref={(element) => listbox.registerItem("date", element)} />
						<button
							type="button"
							onClick={() => listbox.scrollActiveIntoView("nearest")}
						>
							滚动
						</button>
					</>
				);
			}
			render(<Manual />);
			expect(scrollIntoView()).not.toHaveBeenCalled();
			fireEvent.click(screen.getByRole("button", { name: "滚动" }));
			expect(scrollIntoView()).toHaveBeenCalledTimes(1);
		});
	});
});
