import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { flushSync } from "react-dom";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../dialog";
import { Field } from "../../field";
import { Combobox, type ComboboxOption, type ComboboxProps } from "../combobox";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const input = () => screen.getByRole("combobox") as HTMLInputElement;
const panel = () => screen.queryByRole("listbox");
const rows = () => screen.queryAllByRole("option");
const labels = () => rows().map((row) => row.textContent);
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
const press = (key: string, init: KeyboardEventInit = {}) =>
	fireEvent.keyDown(input(), { key, ...init });
const activeRow = () => {
	const id = input().getAttribute("aria-activedescendant");
	return id ? document.getElementById(id) : null;
};
const focus = () => act(() => input().focus());
const emptyText = () => document.querySelector(".v-picker-empty")?.textContent;

const TAGS: ComboboxOption[] = [
	"Go",
	"Rust",
	"React",
	"Vue",
	"Vite",
	"Postgres",
	"Redis",
	"Tailwind",
	"踩坑",
	"随笔",
].map((tag) => ({ value: tag.toLowerCase(), label: tag }));

function Fixture(props: Partial<ComboboxProps>) {
	return <Combobox aria-label="标签" options={TAGS} {...props} />;
}

describe("Combobox 角色与展开", () => {
	it("输入框本身是 combobox，带 aria-autocomplete，焦点留在输入框", () => {
		render(<Fixture />);
		expect(input().tagName).toBe("INPUT");
		expect(input().getAttribute("aria-autocomplete")).toBe("list");
		expect(input().getAttribute("aria-expanded")).toBe("false");
		expect(input().hasAttribute("aria-controls")).toBe(false);

		focus();
		expect(input().getAttribute("aria-expanded")).toBe("true");
		expect(panel()?.id).toBe(input().getAttribute("aria-controls"));
		expect(document.activeElement).toBe(input());
	});

	it("聚焦即展开，没打字时没有高亮项，打字后默认高亮第一条", () => {
		render(<Fixture />);
		focus();
		expect(rows()).toHaveLength(8);
		expect(input().getAttribute("aria-activedescendant")).toBeNull();

		type("r");
		expect(activeRow()?.textContent).toBe("Rust");
		expect(activeRow()?.getAttribute("aria-selected")).toBe("true");
		expect(rows().filter((row) => row.getAttribute("aria-selected") === "true")).toHaveLength(
			1,
		);
	});

	it("listbox 取输入框的名称", () => {
		render(<Fixture />);
		focus();
		expect(panel()?.getAttribute("aria-label")).toBe("标签");
	});

	it("没有选项且没打字时不展开", () => {
		render(<Fixture options={[]} />);
		focus();
		expect(input().getAttribute("aria-expanded")).toBe("false");
		expect(panel()).toBeNull();
	});

	it("点击输入框在 Esc 收起之后可以重新展开", async () => {
		render(<Fixture />);
		focus();
		press("Escape");
		await waitFor(() => expect(panel()).toBeNull());
		fireEvent.click(input());
		expect(panel()).not.toBeNull();
	});
});

describe("Combobox 匹配", () => {
	it("大小写不敏感，匹配任意位置", () => {
		render(<Fixture />);
		focus();
		type("ED");
		expect(labels()).toEqual(["Redis"]);
		type("t");
		expect(labels()).toEqual(["Rust", "React", "Vite", "Postgres", "Tailwind"]);
	});

	it("命中的文字加 mark，只标第一处", () => {
		render(<Fixture />);
		focus();
		type("e");
		const marks = panel()?.querySelectorAll("mark") ?? [];
		expect(marks.length).toBeGreaterThan(0);
		expect([...marks].every((mark) => mark.textContent?.toLowerCase() === "e")).toBe(true);
		const redis = screen.getByRole("option", { name: "Redis" });
		expect(redis.querySelectorAll("mark")).toHaveLength(1);
		expect(redis.querySelector("mark")?.textContent).toBe("e");
	});

	it("highlight 为 false 时不加 mark", () => {
		render(<Fixture highlight={false} />);
		focus();
		type("e");
		expect(panel()?.querySelector("mark")).toBeNull();
	});

	it("建议最多 8 条，maxSuggestions 可改", () => {
		const many = Array.from({ length: 20 }, (_, index) => ({
			value: `item-${index}`,
			label: `项 ${index}`,
		}));
		const { rerender } = render(<Fixture options={many} />);
		focus();
		expect(rows()).toHaveLength(8);
		rerender(<Fixture options={many} maxSuggestions={3} />);
		expect(rows()).toHaveLength(3);
	});

	it("filter 传 false 列出全部，传函数自定义匹配", () => {
		const { rerender } = render(<Fixture filter={false} />);
		focus();
		type("zzz");
		expect(rows()).toHaveLength(8);
		rerender(<Fixture filter={(option, query) => option.value.startsWith(query)} />);
		type("go");
		expect(labels()).toEqual(["Go"]);
	});

	it("没有匹配时显示 emptyText，缺省是「没有匹配的项」", () => {
		const { rerender } = render(<Fixture />);
		focus();
		type("zzz");
		expect(emptyText()).toBe("没有匹配的项");
		expect(rows()).toHaveLength(0);
		expect(input().getAttribute("aria-expanded")).toBe("true");
		rerender(<Fixture emptyText={(query) => `没有 ${query}`} />);
		expect(emptyText()).toBe("没有 zzz");
	});

	it("两行选项、分组与附加信息", () => {
		const grouped: ComboboxOption[] = [
			{ value: "a", label: "博客", description: "长文章", group: "站内", meta: "11-02" },
			{ value: "b", label: "手记", group: "站内" },
			{ value: "c", label: "订阅", group: "站外" },
		];
		render(<Fixture options={grouped} />);
		focus();
		const groups = screen.getAllByRole("group");
		expect(groups).toHaveLength(2);
		expect(groups[0].getAttribute("aria-labelledby")).toBeTruthy();
		expect(groups[0].textContent).toContain("站内");
		expect(groups[1].textContent).toContain("站外");
		expect(screen.getByText("长文章")).not.toBeNull();
		expect(screen.getByText("11-02")).not.toBeNull();
	});
});

describe("Combobox 选择", () => {
	it("↑ ↓ 移动高亮，Enter 选中：值与输入框文字更新、面板收起、焦点不动", async () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		focus();
		type("r");
		expect(activeRow()?.textContent).toBe("Rust");
		press("ArrowDown");
		expect(activeRow()?.textContent).toBe("React");
		press("ArrowUp");
		press("ArrowUp");
		expect(activeRow()?.textContent).toBe("Rust");
		press("ArrowDown");
		press("Enter");
		expect(onValueChange).toHaveBeenCalledWith("react");
		expect(input().value).toBe("React");
		await waitFor(() => expect(panel()).toBeNull());
		expect(document.activeElement).toBe(input());
	});

	it("方向键到头不循环，跳过禁用项", () => {
		const options = [
			{ value: "a", label: "甲" },
			{ value: "b", label: "乙", disabled: true },
			{ value: "c", label: "丙" },
		];
		render(<Fixture options={options} />);
		focus();
		press("ArrowDown");
		expect(activeRow()?.textContent).toBe("甲");
		press("ArrowDown");
		expect(activeRow()?.textContent).toBe("丙");
		press("ArrowDown");
		expect(activeRow()?.textContent).toBe("丙");
		expect(screen.getByRole("option", { name: "乙" }).getAttribute("aria-disabled")).toBe(
			"true",
		);
	});

	it("点击建议选中，禁用项点不动", () => {
		const onValueChange = vi.fn();
		const options = [
			{ value: "a", label: "甲" },
			{ value: "b", label: "乙", disabled: true },
		];
		render(<Fixture options={options} onValueChange={onValueChange} />);
		focus();
		fireEvent.click(screen.getByRole("option", { name: "乙" }));
		expect(onValueChange).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("option", { name: "甲" }));
		expect(onValueChange).toHaveBeenCalledWith("a");
		expect(input().value).toBe("甲");
	});

	it("面板关闭时 ↓ 直接展开，没有高亮就落在第一条，↑ 落在最后一条", async () => {
		render(<Fixture />);
		focus();
		press("Escape");
		await waitFor(() => expect(panel()).toBeNull());
		expect(press("ArrowDown")).toBe(false);
		expect(activeRow()?.textContent).toBe("Go");
		press("Escape");
		await waitFor(() => expect(panel()).toBeNull());
		press("ArrowUp");
		expect(activeRow()?.textContent).toBe("Tailwind");
	});

	it("已选值展开时高亮已选项，选中项带勾且字重加粗", () => {
		render(<Fixture defaultValue="vue" />);
		focus();
		expect(input().value).toBe("Vue");
		expect(rows()).toHaveLength(8);
		expect(activeRow()?.textContent).toBe("Vue");
		expect(activeRow()?.hasAttribute("data-selected")).toBe(true);
	});

	it("Home 与 End 留给输入框移动光标，PageDown 到底", () => {
		render(<Fixture />);
		focus();
		type("r");
		const home = fireEvent.keyDown(input(), { key: "Home" });
		expect(home).toBe(true);
		expect(activeRow()?.textContent).toBe("Rust");
		const end = fireEvent.keyDown(input(), { key: "End" });
		expect(end).toBe(true);
		expect(activeRow()?.textContent).toBe("Rust");
	});

	it("输入法选词期间 ↓ 与 Enter 不处理", () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		focus();
		type("r");
		const before = activeRow()?.textContent;
		expect(press("ArrowDown", { isComposing: true })).toBe(true);
		expect(activeRow()?.textContent).toBe(before);
		expect(press("Enter", { isComposing: true })).toBe(true);
		expect(onValueChange).not.toHaveBeenCalled();
		expect(panel()).not.toBeNull();
		expect(press("Enter", { keyCode: 229 })).toBe(true);
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("没有高亮项时 Enter 不拦截，表单照常提交", () => {
		render(<Fixture />);
		focus();
		expect(press("Enter")).toBe(true);
	});
});

describe("Combobox 创建", () => {
	it("没有完全相同的建议时末行是创建项，Enter 采用它", () => {
		const onCreate = vi.fn();
		const onValueChange = vi.fn();
		render(<Fixture creatable onCreate={onCreate} onValueChange={onValueChange} />);
		focus();
		type("Svelte");
		expect(labels()).toEqual(["创建「Svelte」"]);
		expect(activeRow()?.textContent).toBe("创建「Svelte」");
		press("Enter");
		expect(onCreate).toHaveBeenCalledWith("Svelte");
		expect(onValueChange).toHaveBeenCalledWith("Svelte");
		expect(input().value).toBe("Svelte");
	});

	it("创建项排在建议之后，不计入建议上限", () => {
		render(<Fixture creatable />);
		focus();
		type("re");
		expect(labels().at(-1)).toBe("创建「re」");
		expect(labels().slice(0, -1)).toEqual(["React", "Postgres", "Redis"]);
	});

	it("有完全相同的建议时不出现创建项，大小写不敏感", () => {
		render(<Fixture creatable />);
		focus();
		type("go");
		expect(labels()).toEqual(["Go"]);
	});

	it("不开 creatable 没有创建项，Enter 也不会采用键入的文字", () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		focus();
		type("zzz");
		press("Enter");
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("面板已收起时 Enter 直接采用键入的文字；与建议完全相同就选建议", async () => {
		const onCreate = vi.fn();
		const onValueChange = vi.fn();
		render(<Fixture creatable onCreate={onCreate} onValueChange={onValueChange} />);
		focus();
		type("Svelte");
		press("Escape");
		await waitFor(() => expect(panel()).toBeNull());
		press("Enter");
		expect(onCreate).toHaveBeenCalledWith("Svelte");

		type("RUST");
		press("Escape");
		await waitFor(() => expect(panel()).toBeNull());
		press("Enter");
		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(onValueChange).toHaveBeenLastCalledWith("rust");
		expect(input().value).toBe("Rust");
	});
});

describe("Combobox Esc、清除与失焦", () => {
	it("Esc 先收起并保留文字，再按一次清空文字与已选值", async () => {
		const onValueChange = vi.fn();
		render(<Fixture defaultValue="rust" onValueChange={onValueChange} />);
		focus();
		type("rea");
		press("Escape");
		await waitFor(() => expect(panel()).toBeNull());
		expect(input().value).toBe("rea");

		press("Escape");
		expect(input().value).toBe("");
		expect(onValueChange).toHaveBeenLastCalledWith("");
		expect(document.activeElement).toBe(input());
	});

	it("根上已有的文档级监听对 Esc 先 preventDefault，先收起、再清空照样生效", async () => {
		const swallow = (event: KeyboardEvent) => event.key === "Escape" && event.preventDefault();
		document.addEventListener("keydown", swallow, true);
		try {
			render(<Fixture defaultInputValue="re" />);
			focus();
			press("Escape");
			await waitFor(() => expect(panel()).toBeNull());
			expect(input().value).toBe("re");
			press("Escape");
			expect(input().value).toBe("");
		} finally {
			document.removeEventListener("keydown", swallow, true);
		}
	});

	it("onKeyDown 里 preventDefault 可以取消组合框自己的按键处理", () => {
		render(
			<Fixture
				onKeyDown={(event) => {
					if (event.key === "Enter") event.preventDefault();
				}}
				creatable
			/>,
		);
		focus();
		type("Svelte");
		expect(press("Enter")).toBe(false);
		expect(input().value).toBe("Svelte");
		expect(panel()).not.toBeNull();
	});

	it("文档捕获阶段已被他人 preventDefault，调用方也 preventDefault：Enter 不选中、不创建", () => {
		const swallow = (event: KeyboardEvent) => event.key === "Enter" && event.preventDefault();
		document.addEventListener("keydown", swallow, true);
		try {
			const onValueChange = vi.fn();
			render(
				<Fixture
					creatable
					onValueChange={onValueChange}
					onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
				/>,
			);
			focus();
			type("Svelte");
			press("Enter");
			expect(onValueChange).not.toHaveBeenCalled();
			expect(input().value).toBe("Svelte");
		} finally {
			document.removeEventListener("keydown", swallow, true);
		}
	});

	it("文档捕获阶段已被他人 preventDefault，调用方不取消：Enter 照常选中", () => {
		const swallow = (event: KeyboardEvent) => event.key === "Enter" && event.preventDefault();
		document.addEventListener("keydown", swallow, true);
		try {
			const onValueChange = vi.fn();
			render(<Fixture creatable onValueChange={onValueChange} />);
			focus();
			type("Svelte");
			press("Enter");
			expect(onValueChange).toHaveBeenCalledWith("Svelte");
		} finally {
			document.removeEventListener("keydown", swallow, true);
		}
	});

	it("面板在按键回调之前已被收起并提交时，这次 Esc 仍只算收起，不清空文字", () => {
		let setOpenOutside: (open: boolean) => void = () => {};
		function Controlled() {
			const [open, setOpen] = useState(true);
			setOpenOutside = setOpen;
			return <Fixture defaultInputValue="re" open={open} onOpenChange={setOpen} />;
		}
		render(<Controlled />);
		expect(panel()).not.toBeNull();
		const closeFirst = (event: KeyboardEvent) => {
			if (event.key === "Escape") flushSync(() => setOpenOutside(false));
		};
		document.addEventListener("keydown", closeFirst, true);
		try {
			press("Escape");
			expect(input().value).toBe("re");
			press("Escape");
			expect(input().value).toBe("");
		} finally {
			document.removeEventListener("keydown", closeFirst, true);
		}
	});

	it("在 Dialog 里第一次 Esc 只收起面板，不关 Dialog", async () => {
		render(
			<Dialog defaultOpen>
				<DialogContent>
					<DialogTitle>编辑</DialogTitle>
					<DialogDescription>标签</DialogDescription>
					<Fixture />
				</DialogContent>
			</Dialog>,
		);
		await settle();
		focus();
		expect(panel()).not.toBeNull();
		fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
		await waitFor(() => expect(panel()).toBeNull());
		expect(screen.queryByRole("dialog")).not.toBeNull();
		fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("清除钮清空文字与已选值，焦点留在输入框", () => {
		const onValueChange = vi.fn();
		const onInputChange = vi.fn();
		render(
			<Fixture
				defaultValue="rust"
				onValueChange={onValueChange}
				onInputChange={onInputChange}
			/>,
		);
		const clear = screen.getByRole("button", { name: "清除", hidden: true });
		expect(clear.getAttribute("tabindex")).toBeNull();
		fireEvent.click(clear);
		expect(input().value).toBe("");
		expect(onValueChange).toHaveBeenCalledWith("");
		expect(onInputChange).toHaveBeenLastCalledWith("", "clear");
		expect(document.activeElement).toBe(input());
		expect(screen.queryByRole("button", { name: "清除", hidden: true })).toBeNull();
	});

	it("clearable 为 false 没有清除钮", () => {
		render(<Fixture defaultValue="rust" clearable={false} />);
		expect(screen.queryByRole("button", { name: "清除", hidden: true })).toBeNull();
	});

	it("失焦时没选中的草稿还原为已选标签", async () => {
		const onInputChange = vi.fn();
		render(
			<>
				<Fixture defaultValue="rust" onInputChange={onInputChange} />
				<button type="button">别处</button>
			</>,
		);
		focus();
		type("zzz");
		act(() => screen.getByRole("button", { name: "别处" }).focus());
		await waitFor(() => expect(input().value).toBe("Rust"));
		expect(onInputChange).toHaveBeenLastCalledWith("Rust", "revert");
		await waitFor(() => expect(panel()).toBeNull());
	});

	it("没有已选值时失焦清掉草稿，creatable 未确认的文字同样还原", async () => {
		render(
			<>
				<Fixture creatable />
				<button type="button">别处</button>
			</>,
		);
		focus();
		type("Svelte");
		act(() => screen.getByRole("button", { name: "别处" }).focus());
		await waitFor(() => expect(input().value).toBe(""));
	});

	it("键入删光文字相当于清除已选值，失焦后不会又还原", async () => {
		const onValueChange = vi.fn();
		render(
			<>
				<Fixture defaultValue="rust" onValueChange={onValueChange} />
				<button type="button">别处</button>
			</>,
		);
		focus();
		type("");
		expect(onValueChange).toHaveBeenCalledWith("");
		act(() => screen.getByRole("button", { name: "别处" }).focus());
		await waitFor(() => expect(panel()).toBeNull());
		expect(input().value).toBe("");
	});

	it("Tab 收起并放行去下一个控件，不把焦点抢回输入框", async () => {
		render(
			<>
				<Fixture />
				<button type="button">下一个</button>
			</>,
		);
		focus();
		expect(press("Tab")).toBe(true);
		const next = screen.getByRole("button", { name: "下一个" });
		act(() => next.focus());
		await waitFor(() => expect(panel()).toBeNull());
		expect(document.activeElement).toBe(next);
	});

	it("点外部收起", async () => {
		render(
			<>
				<Fixture />
				<p>别处</p>
			</>,
		);
		focus();
		await settle();
		const away = screen.getByText("别处");
		fireEvent.pointerDown(away, { pointerType: "mouse", button: 0 });
		fireEvent.pointerUp(away, { pointerType: "mouse", button: 0 });
		fireEvent.click(away);
		await waitFor(() => expect(panel()).toBeNull());
	});

	it("点建议行不让输入框失焦", () => {
		render(<Fixture />);
		focus();
		const notPrevented = fireEvent.mouseDown(rows()[0]);
		expect(notPrevented).toBe(false);
		expect(document.activeElement).toBe(input());
	});
});

describe("Combobox 受控", () => {
	it("value 与 inputValue 受控：父级不接受就不变", () => {
		const onValueChange = vi.fn();
		const onInputChange = vi.fn();
		render(
			<Fixture
				value="go"
				inputValue="Go"
				onValueChange={onValueChange}
				onInputChange={onInputChange}
			/>,
		);
		focus();
		type("rust");
		expect(onInputChange).toHaveBeenCalledWith("rust", "input");
		expect(input().value).toBe("Go");
	});

	it("外部改了 value，输入框跟着换成标签；键入中不打断", () => {
		function Controlled({ value }: { value: string }) {
			return <Fixture value={value} onValueChange={() => {}} />;
		}
		const { rerender } = render(<Controlled value="go" />);
		expect(input().value).toBe("Go");
		rerender(<Controlled value="rust" />);
		expect(input().value).toBe("Rust");

		focus();
		type("draft");
		rerender(<Controlled value="vue" />);
		expect(input().value).toBe("draft");
	});

	it("选项晚到：已选值先显示 value，标签到了再换成标签", () => {
		const { rerender } = render(<Fixture options={[]} value="rust" onValueChange={() => {}} />);
		expect(input().value).toBe("rust");
		rerender(<Fixture options={TAGS} value="rust" onValueChange={() => {}} />);
		expect(input().value).toBe("Rust");
	});

	it("open 受控", () => {
		const onOpenChange = vi.fn();
		const { rerender } = render(<Fixture open={false} onOpenChange={onOpenChange} />);
		focus();
		expect(onOpenChange).toHaveBeenCalledWith(true);
		expect(panel()).toBeNull();
		rerender(<Fixture open onOpenChange={onOpenChange} />);
		expect(panel()).not.toBeNull();
	});

	it("受控包装里选中后值回写，输入框显示标签", () => {
		function Wrapper() {
			const [value, setValue] = useState("");
			return (
				<>
					<Fixture value={value} onValueChange={setValue} />
					<output>{value}</output>
				</>
			);
		}
		render(<Wrapper />);
		focus();
		fireEvent.click(screen.getByRole("option", { name: "Vue" }));
		expect(document.querySelector("output")?.textContent).toBe("vue");
		expect(input().value).toBe("Vue");
	});
});

describe("Combobox 异步", () => {
	it("停手 300ms 后才调用 onSearch，期间指示器与 aria-busy 已出现", () => {
		vi.useFakeTimers();
		const onSearch = vi.fn();
		render(<Fixture onSearch={onSearch} filter={false} />);
		focus();
		type("p");
		act(() => vi.advanceTimersByTime(200));
		type("po");
		expect(input().getAttribute("aria-busy")).toBe("true");
		act(() => vi.advanceTimersByTime(299));
		expect(onSearch).not.toHaveBeenCalled();
		act(() => vi.advanceTimersByTime(1));
		expect(onSearch).toHaveBeenCalledTimes(1);
		expect(onSearch).toHaveBeenCalledWith("po", { signal: expect.any(AbortSignal) });
		expect(input().getAttribute("aria-busy")).toBeNull();
	});

	it("loading 时右侧是指示器，列表保留旧结果不闪空，播报「正在查找」", () => {
		const { rerender } = render(<Fixture onSearch={() => {}} />);
		focus();
		type("p");
		rerender(<Fixture onSearch={() => {}} loading />);
		expect(input().getAttribute("aria-busy")).toBe("true");
		expect(rows()).toHaveLength(8);
		expect(screen.getByRole("status").textContent).toBe("正在查找");
		expect(document.querySelector("[data-status=loading]")).not.toBeNull();
	});

	it("每一轮查询带 AbortSignal：逆序返回时旧轮的 signal 已 aborted", () => {
		vi.useFakeTimers();
		const signals: AbortSignal[] = [];
		const onSearch = vi.fn((_query: string, { signal }: { signal: AbortSignal }) => {
			signals.push(signal);
		});
		render(<Fixture onSearch={onSearch} />);
		focus();
		type("a");
		act(() => vi.advanceTimersByTime(300));
		expect(signals).toHaveLength(1);
		expect(signals[0].aborted).toBe(false);
		type("ab");
		expect(signals[0].aborted).toBe(true);
		act(() => vi.advanceTimersByTime(300));
		expect(signals).toHaveLength(2);
		expect(signals[1].aborted).toBe(false);
	});

	it("失焦、选中、卸载中止在途的查询", () => {
		vi.useFakeTimers();
		const signals: AbortSignal[] = [];
		const onSearch = (_query: string, { signal }: { signal: AbortSignal }) => {
			signals.push(signal);
		};
		const { unmount } = render(
			<>
				<Fixture onSearch={onSearch} />
				<button type="button">别处</button>
			</>,
		);
		focus();
		type("p");
		act(() => vi.advanceTimersByTime(300));
		act(() => screen.getByRole("button", { name: "别处" }).focus());
		expect(signals[0].aborted).toBe(true);
		focus();
		type("q");
		act(() => vi.advanceTimersByTime(300));
		expect(signals[1].aborted).toBe(false);
		unmount();
		expect(signals[1].aborted).toBe(true);
	});

	it("展开且在查找时，即使没有查询文字也优先播报「正在查找」", () => {
		const { rerender } = render(<Fixture onSearch={() => {}} />);
		focus();
		expect(screen.getByRole("status").textContent).toBe("8 条建议");
		rerender(<Fixture onSearch={() => {}} loading />);
		expect(screen.getByRole("status").textContent).toBe("正在查找");
	});

	it("没有结果又在查找时面板写「正在查找…」，查完写「没有找到「xxx」」", () => {
		vi.useFakeTimers();
		const { rerender } = render(<Fixture options={[]} onSearch={() => {}} loading />);
		focus();
		type("zz");
		expect(emptyText()).toBe("正在查找…");
		rerender(<Fixture options={[]} onSearch={() => {}} />);
		act(() => vi.advanceTimersByTime(300));
		expect(emptyText()).toBe("没有找到「zz」");
	});

	it("有 onSearch 时选项视为已筛过，不再在组合框里过滤", () => {
		render(<Fixture onSearch={() => {}} />);
		focus();
		type("zzz");
		expect(rows()).toHaveLength(8);
	});

	it("失焦与卸载取消还没触发的查询", () => {
		vi.useFakeTimers();
		const onSearch = vi.fn();
		const { unmount } = render(<Fixture onSearch={onSearch} />);
		focus();
		type("p");
		unmount();
		act(() => vi.advanceTimersByTime(1000));
		expect(onSearch).not.toHaveBeenCalled();
	});

	it("键入后失焦，不会补发查询", () => {
		vi.useFakeTimers();
		const onSearch = vi.fn();
		render(
			<>
				<Fixture onSearch={onSearch} />
				<button type="button">别处</button>
			</>,
		);
		focus();
		type("p");
		act(() => screen.getByRole("button", { name: "别处" }).focus());
		act(() => vi.advanceTimersByTime(1000));
		expect(onSearch).not.toHaveBeenCalled();
	});

	it("结果晚到时高亮补到第一条", () => {
		const { rerender } = render(<Fixture options={[]} onSearch={() => {}} />);
		focus();
		type("r");
		rerender(<Fixture options={TAGS.slice(1, 3)} onSearch={() => {}} />);
		expect(activeRow()?.textContent).toBe("Rust");
	});
});

describe("Combobox 读屏播报", () => {
	it("展开且有建议时播报条数，条数变化随之更新", () => {
		render(<Fixture />);
		expect(screen.getByRole("status").textContent).toBe("");
		focus();
		expect(screen.getByRole("status").textContent).toBe("8 条建议");
		type("re");
		expect(screen.getByRole("status").textContent).toBe("3 条建议");
		type("zzz");
		expect(screen.getByRole("status").textContent).toBe("没有匹配的项");
	});

	it("创建项不算建议", () => {
		render(<Fixture creatable />);
		focus();
		type("Svelte");
		expect(screen.getByRole("status").textContent).toBe("0 条建议");
	});
});

describe("Combobox 外壳与接线", () => {
	it("透传 id、aria-describedby 与 aria-invalid，invalid 与 valid 给外壳属性", () => {
		const { rerender } = render(
			<>
				<p id="hint">必填</p>
				<Fixture id="tag" aria-describedby="hint" aria-invalid />
			</>,
		);
		expect(input().id).toBe("tag");
		expect(input().getAttribute("aria-describedby")).toBe("hint");
		expect(input().getAttribute("aria-invalid")).toBe("true");
		const shell = input().closest("[data-slot=combobox]") as HTMLElement;
		expect(shell.hasAttribute("data-invalid")).toBe(true);

		rerender(<Fixture invalid valid variant="outline" controlSize="lg" />);
		const next = input().closest("[data-slot=combobox]") as HTMLElement;
		expect(input().getAttribute("aria-invalid")).toBe("true");
		expect(next.hasAttribute("data-valid")).toBe(false);
		expect(next.classList.contains("v-input-control--outline")).toBe(true);
		expect(next.classList.contains("v-input-control--lg")).toBe(true);

		rerender(<Fixture valid />);
		expect(next.hasAttribute("data-valid")).toBe(true);
		expect(input().getAttribute("aria-invalid")).toBeNull();
	});

	it("className 与 style 属于外壳，placeholder 等原生属性属于输入框", () => {
		render(<Fixture className="w-48" style={{ width: 200 }} placeholder="输入或选择标签" />);
		const shell = input().closest("[data-slot=combobox]") as HTMLElement;
		expect(shell.classList.contains("w-48")).toBe(true);
		expect(shell.style.width).toBe("200px");
		expect(input().getAttribute("placeholder")).toBe("输入或选择标签");
		expect(input().classList.contains("w-48")).toBe(false);
	});

	it("Field 把 id、aria-describedby、aria-invalid 接到输入框，标签 for 命中它", () => {
		render(
			<Field label="标签" hint="选一个" error="必须选择">
				<Combobox options={TAGS} />
			</Field>,
		);
		expect(input().getAttribute("aria-invalid")).toBe("true");
		const describedBy = input().getAttribute("aria-describedby") ?? "";
		expect(document.getElementById(describedBy.split(" ").at(-1) ?? "")?.textContent).toContain(
			"必须选择",
		);
		expect(screen.getByLabelText("标签")).toBe(input());
	});

	it("loading 在外壳上留 data-loading", () => {
		render(<Fixture loading />);
		const shell = input().closest("[data-slot=combobox]") as HTMLElement;
		expect(shell.hasAttribute("data-loading")).toBe(true);
		expect(input().getAttribute("aria-busy")).toBe("true");
	});

	it("leading 图标放在输入框之前", () => {
		render(<Fixture leading={<svg data-testid="icon" />} />);
		const shell = input().closest("[data-slot=combobox]") as HTMLElement;
		expect(shell.firstElementChild?.querySelector("[data-testid=icon]")).not.toBeNull();
	});

	it("disabled 与 readOnly 都不展开，readOnly 仍可聚焦、没有清除钮", () => {
		const { rerender } = render(<Fixture defaultValue="rust" disabled />);
		expect(input().disabled).toBe(true);
		fireEvent.click(input());
		expect(panel()).toBeNull();

		rerender(<Fixture defaultValue="rust" readOnly />);
		focus();
		expect(document.activeElement).toBe(input());
		fireEvent.click(input());
		press("ArrowDown");
		expect(panel()).toBeNull();
		expect(input().readOnly).toBe(true);
		expect(screen.queryByRole("button", { name: "清除", hidden: true })).toBeNull();
	});

	it("required 写 aria-required，不写原生 required", () => {
		render(<Fixture required />);
		expect(input().getAttribute("aria-required")).toBe("true");
		expect(input().required).toBe(false);
	});

	it("转发 ref、onFocus、onBlur、onKeyDown", () => {
		const ref = { current: null as HTMLInputElement | null };
		const onFocus = vi.fn();
		const onBlur = vi.fn();
		const onKeyDown = vi.fn();
		render(<Fixture ref={ref} onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown} />);
		focus();
		press("a");
		act(() => input().blur());
		expect(ref.current).toBe(input());
		expect(onFocus).toHaveBeenCalled();
		expect(onKeyDown).toHaveBeenCalled();
		expect(onBlur).toHaveBeenCalled();
	});

	it("默认挂到 body，container 可改挂到指定容器", () => {
		const host = document.createElement("div");
		document.body.append(host);
		const { unmount } = render(<Fixture />);
		focus();
		expect(panel()?.closest("[data-slot=picker-panel]")?.parentElement?.parentElement).toBe(
			document.body,
		);
		unmount();

		render(<Fixture container={host} />);
		focus();
		expect(host.contains(panel())).toBe(true);
		host.remove();
	});

	it("服务端渲染不报错，输出输入框与已选标签", () => {
		const html = renderToString(<Fixture defaultValue="rust" name="tag" />);
		expect(html).toContain('role="combobox"');
		expect(html).toContain('value="Rust"');
		expect(html).toContain('type="hidden"');
	});
});

describe("Combobox 表单", () => {
	const form = (container: HTMLElement) => container.querySelector("form") as HTMLFormElement;

	it("给了 name 才渲染隐藏输入，提交已选值而不是草稿", () => {
		const { container, rerender } = render(
			<form>
				<Fixture defaultValue="rust" />
			</form>,
		);
		expect(container.querySelector("input[type=hidden]")).toBeNull();
		rerender(
			<form>
				<Fixture name="tag" defaultValue="rust" />
			</form>,
		);
		expect(new FormData(form(container)).get("tag")).toBe("rust");
		focus();
		type("draft");
		expect(new FormData(form(container)).get("tag")).toBe("rust");
	});

	it("没选时提交空串，disabled 时不提交，创建的文字提交文字本身", () => {
		const { container, rerender } = render(
			<form>
				<Fixture name="tag" creatable />
			</form>,
		);
		expect(new FormData(form(container)).get("tag")).toBe("");
		focus();
		type("Svelte");
		press("Enter");
		expect(new FormData(form(container)).get("tag")).toBe("Svelte");
		rerender(
			<form>
				<Fixture name="tag" disabled />
			</form>,
		);
		expect(new FormData(form(container)).has("tag")).toBe(false);
	});

	it("表单 reset 回到 defaultValue 与它的标签", async () => {
		const { container } = render(
			<form>
				<Fixture name="tag" defaultValue="go" />
			</form>,
		);
		focus();
		fireEvent.click(screen.getByRole("option", { name: "Vue" }));
		expect(new FormData(form(container)).get("tag")).toBe("vue");
		act(() => form(container).reset());
		await waitFor(() => expect(new FormData(form(container)).get("tag")).toBe("go"));
		expect(input().value).toBe("Go");
	});

	it("没给 defaultValue 时 reset 回到空", async () => {
		const { container } = render(
			<form>
				<Fixture name="tag" />
			</form>,
		);
		focus();
		fireEvent.click(screen.getByRole("option", { name: "Vue" }));
		act(() => form(container).reset());
		await waitFor(() => expect(input().value).toBe(""));
		expect(new FormData(form(container)).get("tag")).toBe("");
	});

	it("受控且没给 defaultValue 时 reset 也通知调用方回到空", async () => {
		const onValueChange = vi.fn();
		const { container } = render(
			<form>
				<Fixture name="tag" value="rust" onValueChange={onValueChange} />
			</form>,
		);
		act(() => form(container).reset());
		await waitFor(() => expect(onValueChange).toHaveBeenCalledWith(""));
	});

	it("form 指向外置表单时，那个表单 reset 恢复已选值与文字", async () => {
		render(
			<>
				<form id="outside" />
				<Fixture name="tag" form="outside" defaultValue="go" />
			</>,
		);
		focus();
		fireEvent.click(screen.getByRole("option", { name: "Vue" }));
		expect(input().value).toBe("Vue");
		const outside = document.getElementById("outside") as HTMLFormElement;
		act(() => outside.reset());
		await waitFor(() => expect(input().value).toBe("Go"));
		expect(new FormData(outside).get("tag")).toBe("go");
	});
});
