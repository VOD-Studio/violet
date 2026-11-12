import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../dialog";
import { Field } from "../../field";
import {
	TreeSelect,
	type TreeSelectMultipleProps,
	type TreeSelectOption,
	type TreeSelectSingleProps,
} from "../tree-select";

// 包的 lib 目标没有 Promise.withResolvers
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const OPTIONS: TreeSelectOption[] = [
	{
		value: "2025",
		label: "2025",
		children: [
			{
				value: "trip",
				label: "旅行",
				children: [
					{ value: "duku", label: "独库公路" },
					{ value: "qinghai", label: "青海湖" },
				],
			},
			{ value: "daily", label: "日常", children: [{ value: "breakfast", label: "早餐" }] },
		],
	},
	{
		value: "2026",
		label: "2026",
		meta: "4",
		children: [
			{
				value: "season",
				label: "季节",
				children: [
					{ value: "spring", label: "春" },
					{ value: "summer", label: "夏" },
					{ value: "autumn", label: "秋" },
					{ value: "winter", label: "冬" },
				],
			},
		],
	},
	{ value: "avatar", label: "头像" },
];

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const trigger = () => screen.getByRole("combobox");
const tree = () => screen.queryByRole("tree");
const rows = () => screen.queryAllByRole("treeitem");
const rowNames = () => rows().map((row) => row.textContent?.replace(/\s+/g, "") ?? "");
const row = (name: string) => screen.getByRole("treeitem", { name });
const chevronOf = (name: string) =>
	within(row(name)).getByRole("button", { name: "展开或收起", hidden: true });
const press = (key: string, target: Element = trigger(), init: KeyboardEventInit = {}) =>
	fireEvent.keyDown(target, { key, ...init });
const activeRow = () => {
	const id = trigger().getAttribute("aria-activedescendant");
	return id ? document.getElementById(id) : null;
};
const activeName = () => activeRow()?.getAttribute("aria-labelledby");
const activeLabel = () => {
	const labelId = activeName();
	return labelId ? document.getElementById(labelId)?.textContent : undefined;
};
const openByClick = () => fireEvent.click(trigger());
const checked = (name: string) => row(name).getAttribute("aria-checked");

interface FixtureProps extends Omit<TreeSelectSingleProps, "options"> {
	options?: TreeSelectOption[];
}
function Fixture({ options = OPTIONS, ...props }: FixtureProps) {
	return <TreeSelect aria-label="素材目录" placeholder="选择目录" options={options} {...props} />;
}

type MultiFixtureProps = Omit<TreeSelectMultipleProps, "options" | "multiple"> & {
	options?: TreeSelectOption[];
};
function Multi({ options = OPTIONS, ...props }: MultiFixtureProps) {
	return (
		<TreeSelect
			multiple
			aria-label="素材目录"
			placeholder="选择目录"
			options={options}
			{...props}
		/>
	);
}

describe("TreeSelect 触发器", () => {
	it("是带 combobox、haspopup=tree、expanded、controls 的按钮，显示占位", () => {
		render(<Fixture />);
		expect(trigger().tagName).toBe("BUTTON");
		expect(trigger().getAttribute("aria-haspopup")).toBe("tree");
		expect(trigger().getAttribute("aria-expanded")).toBe("false");
		expect(trigger().getAttribute("aria-controls")).toBeTruthy();
		expect(trigger().textContent).toBe("选择目录");
		expect(trigger().querySelector("[data-placeholder]")).not.toBeNull();
	});

	it("单选显示被选节点的文字，完整路径写进 title 并由状态播报区读出", () => {
		render(<Fixture defaultValue="spring" />);
		expect(trigger().textContent).toBe("春");
		expect(trigger().querySelector("[title]")?.getAttribute("title")).toBe("2026 / 季节 / 春");
		expect(screen.getByRole("status").textContent).toBe("2026 / 季节 / 春");
	});

	it("树里找不到的值原样显示", () => {
		render(<Fixture defaultValue="ghost" />);
		expect(trigger().textContent).toBe("ghost");
	});

	it("透传 id、aria-describedby 与 aria-invalid，invalid 与 valid 给外壳属性", () => {
		const { rerender } = render(
			<>
				<p id="hint">必选</p>
				<Fixture id="folder" aria-describedby="hint" aria-invalid />
			</>,
		);
		expect(trigger().id).toBe("folder");
		expect(trigger().getAttribute("aria-describedby")).toBe("hint");
		expect(trigger().getAttribute("aria-invalid")).toBe("true");
		expect(trigger().hasAttribute("data-invalid")).toBe(true);

		rerender(<Fixture invalid valid variant="outline" controlSize="lg" />);
		expect(trigger().hasAttribute("data-valid")).toBe(false);
		expect(trigger().classList.contains("v-input-control--outline")).toBe(true);
		expect(trigger().classList.contains("v-input-control--lg")).toBe(true);

		rerender(<Fixture valid />);
		expect(trigger().hasAttribute("data-valid")).toBe(true);
		expect(trigger().getAttribute("aria-invalid")).toBeNull();
	});

	it("disabled 不能展开；readOnly 可聚焦但不能展开，也没有箭头", () => {
		const { rerender } = render(<Fixture disabled />);
		expect((trigger() as HTMLButtonElement).disabled).toBe(true);
		openByClick();
		expect(tree()).toBeNull();

		rerender(<Fixture readOnly defaultValue="avatar" />);
		trigger().focus();
		expect(document.activeElement).toBe(trigger());
		openByClick();
		press("ArrowDown");
		expect(tree()).toBeNull();
		expect(trigger().getAttribute("aria-readonly")).toBe("true");
		expect(trigger().querySelector(".v-input-control__trailing")).toBeNull();
	});

	it("loading 时箭头换成指示器并设 aria-busy，没有节点时面板显示加载中", () => {
		render(<Fixture loading options={[]} />);
		expect(trigger().getAttribute("aria-busy")).toBe("true");
		expect(trigger().querySelector(".v-spinner")).not.toBeNull();
		openByClick();
		expect(screen.getByText("加载中…")).not.toBeNull();
	});

	it("没有节点显示无节点，emptyText 可覆盖", () => {
		render(<Fixture options={[]} />);
		openByClick();
		expect(screen.getByText("无节点")).not.toBeNull();
		cleanup();
		render(<Fixture options={[]} emptyText="还没有目录" />);
		openByClick();
		expect(screen.getByText("还没有目录")).not.toBeNull();
	});
});

describe("TreeSelect 在表单项里", () => {
	it("表单项注入的 id 落在触发器上，点标签聚焦触发器，describedby 指向提示", () => {
		render(
			<Field label="素材目录" hint="选一个">
				<TreeSelect options={OPTIONS} placeholder="选择目录" />
			</Field>,
		);
		const label = screen.getByText("素材目录");
		expect(label.closest("label")?.getAttribute("for")).toBe(trigger().id);
		expect(
			document.getElementById(trigger().getAttribute("aria-describedby") ?? "")?.textContent,
		).toContain("选一个");
	});

	it("出错时 aria-invalid 为 true 并带出错外观", () => {
		render(
			<Field label="素材目录" error="必须选择">
				<TreeSelect options={OPTIONS} multiple />
			</Field>,
		);
		expect(trigger().getAttribute("aria-invalid")).toBe("true");
		expect(trigger().closest("[data-invalid]")).not.toBeNull();
	});
});

describe("TreeSelect 面板与行", () => {
	it("点击展开，面板是 role=tree 并有名称，行是 treeitem 带层级与展开状态", () => {
		render(<Fixture />);
		openByClick();
		expect(tree()?.getAttribute("aria-label")).toBe("素材目录");
		expect(tree()?.hasAttribute("aria-multiselectable")).toBe(false);
		expect(rowNames()).toEqual(["2025", "20264", "头像"]);
		expect(row("2025").getAttribute("aria-level")).toBe("1");
		expect(row("2025").getAttribute("aria-expanded")).toBe("false");
		expect(row("头像").hasAttribute("aria-expanded")).toBe(false);
		expect(row("2025").getAttribute("aria-selected")).toBe("false");
		expect(row("2025").getAttribute("aria-posinset")).toBe("1");
		expect(row("2025").getAttribute("aria-setsize")).toBe("3");
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
	});

	it("展开箭头只展开收起，不选中；叶子用空位对齐，没有箭头", () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		openByClick();
		expect(within(row("头像")).queryByRole("button", { hidden: true })).toBeNull();
		fireEvent.click(chevronOf("2025"));
		expect(rowNames()).toEqual(["2025", "旅行", "日常", "20264", "头像"]);
		expect(row("旅行").getAttribute("aria-level")).toBe("2");
		expect(row("2025").getAttribute("aria-expanded")).toBe("true");
		expect(onValueChange).not.toHaveBeenCalled();
		expect(tree()).not.toBeNull();
		fireEvent.click(chevronOf("2025"));
		expect(rowNames()).toEqual(["2025", "20264", "头像"]);
	});

	it("行和箭头上的按下被 preventDefault，触发器不会失焦", () => {
		render(<Fixture />);
		trigger().focus();
		openByClick();
		const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
		act(() => {
			chevronOf("2025").dispatchEvent(event);
		});
		expect(event.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(trigger());
	});

	it("目录行有 meta 时显示在右侧", () => {
		render(<Fixture />);
		openByClick();
		expect(row("2026").querySelector(".v-tree-select__meta")?.textContent).toBe("4");
	});

	it("关闭再打开，展开状态保持", async () => {
		render(<Fixture />);
		openByClick();
		fireEvent.click(chevronOf("2025"));
		press("Escape");
		await waitFor(() => expect(tree()).toBeNull());
		openByClick();
		expect(row("旅行")).not.toBeNull();
	});

	it("受控的 expanded 由调用方回写", () => {
		const onExpandedChange = vi.fn();
		render(<Fixture expanded={["2026"]} onExpandedChange={onExpandedChange} />);
		openByClick();
		expect(rowNames()).toEqual(["2025", "20264", "季节", "头像"]);
		fireEvent.click(chevronOf("2025"));
		expect(onExpandedChange).toHaveBeenCalledWith(["2026", "2025"]);
		expect(rowNames()).toEqual(["2025", "20264", "季节", "头像"]);
	});

	it("打开时把已选节点的祖先全部展开，并高亮它", () => {
		render(<Fixture defaultValue="spring" />);
		openByClick();
		expect(rowNames()).toEqual(["2025", "20264", "季节", "春", "夏", "秋", "冬", "头像"]);
		expect(row("春").getAttribute("aria-selected")).toBe("true");
		expect(row("2026").getAttribute("aria-expanded")).toBe("true");
		expect(activeLabel()).toBe("春");
	});
});

describe("TreeSelect 键盘", () => {
	it.each([["Enter"], [" "], ["ArrowDown"], ["ArrowUp"]])("在触发器上按 %j 展开", (key) => {
		render(<Fixture />);
		trigger().focus();
		press(key);
		expect(tree()).not.toBeNull();
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
	});

	it("焦点留在触发器，aria-activedescendant 指向高亮行，↑ ↓ Home End 在可见行间移动且不循环", () => {
		render(<Fixture />);
		trigger().focus();
		press("ArrowDown");
		expect(activeLabel()).toBe("2025");
		expect(activeRow()?.getAttribute("role")).toBe("treeitem");
		press("ArrowDown");
		expect(activeLabel()).toBe("2026");
		press("End");
		expect(activeLabel()).toBe("头像");
		press("ArrowDown");
		expect(activeLabel()).toBe("头像");
		press("Home");
		expect(activeLabel()).toBe("2025");
		press("ArrowUp");
		expect(activeLabel()).toBe("2025");
		expect(document.activeElement).toBe(trigger());
		expect(activeRow()?.hasAttribute("data-kb")).toBe(true);
	});

	it("→ 展开，已展开再按进入第一个子项；← 收起，已收起再按回到上级", () => {
		render(<Fixture />);
		trigger().focus();
		press("ArrowDown");
		press("ArrowRight");
		expect(row("2025").getAttribute("aria-expanded")).toBe("true");
		expect(activeLabel()).toBe("2025");
		press("ArrowRight");
		expect(activeLabel()).toBe("旅行");
		press("ArrowRight");
		press("ArrowRight");
		expect(activeLabel()).toBe("独库公路");
		// 叶子上 → 不动
		press("ArrowRight");
		expect(activeLabel()).toBe("独库公路");
		press("ArrowLeft");
		expect(activeLabel()).toBe("旅行");
		press("ArrowLeft");
		expect(row("旅行").getAttribute("aria-expanded")).toBe("false");
		expect(activeLabel()).toBe("旅行");
		press("ArrowLeft");
		expect(activeLabel()).toBe("2025");
		press("ArrowLeft");
		expect(row("2025").getAttribute("aria-expanded")).toBe("false");
		// 顶层已收起的行上 ← 不动
		press("ArrowLeft");
		expect(activeLabel()).toBe("2025");
	});

	it("Enter 选中：单选选完收起并还焦点，值变化只通知一次", async () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		trigger().focus();
		press("ArrowDown");
		press("End");
		press("Enter");
		await waitFor(() => expect(tree()).toBeNull());
		expect(onValueChange).toHaveBeenCalledTimes(1);
		expect(onValueChange).toHaveBeenCalledWith("avatar");
		expect(trigger().textContent).toBe("头像");
		expect(document.activeElement).toBe(trigger());
	});

	it("单选可以选目录本身；点行选中并关闭，点箭头不关", async () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		openByClick();
		fireEvent.click(row("2025"));
		await waitFor(() => expect(tree()).toBeNull());
		expect(onValueChange).toHaveBeenCalledWith("2025");
		expect(trigger().textContent).toBe("2025");
	});

	it("leafOnly：目录上 Enter 与点击只展开收起，只有叶子能选", async () => {
		const onValueChange = vi.fn();
		render(<Fixture leafOnly onValueChange={onValueChange} />);
		trigger().focus();
		press("ArrowDown");
		press("Enter");
		expect(row("2025").getAttribute("aria-expanded")).toBe("true");
		expect(onValueChange).not.toHaveBeenCalled();
		fireEvent.click(row("2025"));
		expect(row("2025").getAttribute("aria-expanded")).toBe("false");
		press("End");
		press("Enter");
		await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("avatar"));
	});

	it("Space 选中高亮行", async () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		trigger().focus();
		press("ArrowDown");
		press("ArrowDown");
		press(" ");
		await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("2026"));
	});

	it("Esc 收起，值不变，焦点还在触发器", async () => {
		render(<Fixture defaultValue="avatar" />);
		trigger().focus();
		openByClick();
		press("Escape");
		await waitFor(() => expect(tree()).toBeNull());
		expect(trigger().textContent).toBe("头像");
		expect(document.activeElement).toBe(trigger());
	});

	it("在 Dialog 里 Esc 只收起面板，不关 Dialog", async () => {
		render(
			<Dialog defaultOpen>
				<DialogContent>
					<DialogTitle>编辑</DialogTitle>
					<DialogDescription>选择目录</DialogDescription>
					<Fixture />
				</DialogContent>
			</Dialog>,
		);
		await settle();
		trigger().focus();
		openByClick();
		expect(tree()).not.toBeNull();
		fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
		await waitFor(() => expect(tree()).toBeNull());
		expect(screen.queryByRole("dialog")).not.toBeNull();
		fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("根上已有的文档级监听对 Esc 先 preventDefault，面板也照样收起", async () => {
		const swallow = (event: KeyboardEvent) => event.key === "Escape" && event.preventDefault();
		document.addEventListener("keydown", swallow, true);
		try {
			render(<Fixture />);
			trigger().focus();
			openByClick();
			press("Escape");
			await waitFor(() => expect(tree()).toBeNull());
		} finally {
			document.removeEventListener("keydown", swallow, true);
		}
	});

	it("Tab 收起并放行去下一个控件，不把焦点抢回触发器", async () => {
		render(
			<>
				<Fixture />
				<button type="button">下一个</button>
			</>,
		);
		trigger().focus();
		openByClick();
		const next = screen.getByRole("button", { name: "下一个" });
		press("Tab");
		act(() => next.focus());
		await waitFor(() => expect(tree()).toBeNull());
		expect(document.activeElement).toBe(next);
	});

	it("焦点移到组件外时收起，点外部收起", async () => {
		render(
			<>
				<Fixture />
				<button type="button">别处</button>
			</>,
		);
		trigger().focus();
		openByClick();
		act(() => screen.getByRole("button", { name: "别处" }).focus());
		await waitFor(() => expect(tree()).toBeNull());

		openByClick();
		await settle();
		fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 0 });
		fireEvent.pointerUp(document.body, { pointerType: "mouse", button: 0 });
		fireEvent.click(document.body);
		await waitFor(() => expect(tree()).toBeNull());
	});

	it("面板展开时点触发器收起", async () => {
		render(<Fixture />);
		openByClick();
		await settle();
		fireEvent.pointerDown(trigger(), { pointerType: "mouse", button: 0 });
		fireEvent.click(trigger());
		await waitFor(() => expect(tree()).toBeNull());
	});

	it("输入法组合中的按键不处理", () => {
		render(<Fixture />);
		trigger().focus();
		press("ArrowDown");
		press("ArrowDown", trigger(), { isComposing: true });
		expect(activeLabel()).toBe("2025");
		press("Enter", trigger(), { isComposing: true });
		expect(tree()).not.toBeNull();
	});

	it("禁用的叶子键盘跳过、点击无效，禁用的目录仍能展开", () => {
		const onValueChange = vi.fn();
		const options: TreeSelectOption[] = [
			{ value: "a", label: "甲" },
			{ value: "b", label: "乙", disabled: true },
			{ value: "c", label: "丙", disabled: true, children: [{ value: "d", label: "丁" }] },
		];
		render(<Fixture options={options} onValueChange={onValueChange} />);
		trigger().focus();
		press("ArrowDown");
		press("ArrowDown");
		expect(activeLabel()).toBe("丙");
		expect(row("乙").getAttribute("aria-disabled")).toBe("true");
		fireEvent.click(row("乙"));
		fireEvent.click(row("丙"));
		expect(onValueChange).not.toHaveBeenCalled();
		press("ArrowRight");
		expect(row("丙").getAttribute("aria-expanded")).toBe("true");
		press("ArrowDown");
		expect(activeLabel()).toBe("丁");
	});
});

describe("TreeSelect 值", () => {
	it("受控：值由调用方回写，不回写就不变", async () => {
		const { rerender } = render(<Fixture value="avatar" />);
		expect(trigger().textContent).toBe("头像");
		openByClick();
		fireEvent.click(row("2025"));
		await waitFor(() => expect(tree()).toBeNull());
		expect(trigger().textContent).toBe("头像");
		rerender(<Fixture value="2025" />);
		expect(trigger().textContent).toBe("2025");
	});

	it("非受控：defaultValue 起步，选择后更新触发器文字", async () => {
		render(<Fixture defaultValue="avatar" />);
		openByClick();
		fireEvent.click(row("2025"));
		await waitFor(() => expect(trigger().textContent).toBe("2025"));
	});

	it("再选当前已选项不重复通知", async () => {
		const onValueChange = vi.fn();
		render(<Fixture defaultValue="avatar" onValueChange={onValueChange} />);
		openByClick();
		fireEvent.click(row("头像"));
		await waitFor(() => expect(tree()).toBeNull());
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("单选选中行右侧有对勾，字重由选中态承担", () => {
		render(<Fixture defaultValue="avatar" />);
		openByClick();
		expect(row("头像").querySelector(".v-tree-select__check")).not.toBeNull();
		expect(row("头像").hasAttribute("data-selected")).toBe(true);
		expect(row("2025").querySelector(".v-tree-select__check")).toBeNull();
	});
});

describe("TreeSelect 多选", () => {
	it("面板带 aria-multiselectable，行用 aria-checked 而不是 aria-selected，带勾选框", () => {
		render(<Multi />);
		openByClick();
		expect(tree()?.getAttribute("aria-multiselectable")).toBe("true");
		expect(row("头像").getAttribute("aria-checked")).toBe("false");
		expect(row("头像").hasAttribute("aria-selected")).toBe(false);
		expect(row("头像").querySelector(".v-tree-select__box")).not.toBeNull();
	});

	it("勾选目录等于勾选它下面全部叶子，面板不收起", () => {
		const onValueChange = vi.fn();
		render(<Multi onValueChange={onValueChange} />);
		openByClick();
		fireEvent.click(chevronOf("2025"));
		fireEvent.click(chevronOf("旅行"));
		fireEvent.click(row("旅行"));
		expect(onValueChange).toHaveBeenLastCalledWith(["duku", "qinghai"]);
		expect(checked("旅行")).toBe("true");
		expect(checked("独库公路")).toBe("true");
		expect(checked("2025")).toBe("mixed");
		expect(checked("日常")).toBe("false");
		expect(tree()).not.toBeNull();
	});

	it("三态：取消其中一个叶子，目录变部分选中；全部选满，目录自动全选", () => {
		render(<Multi defaultValue={["duku", "qinghai"]} />);
		openByClick();
		expect(checked("2025")).toBe("mixed");
		expect(row("2025").querySelector(".v-tree-select__box")?.getAttribute("data-state")).toBe(
			"some",
		);
		expect(checked("旅行")).toBe("true");
		fireEvent.click(row("独库公路"));
		expect(checked("独库公路")).toBe("false");
		expect(checked("旅行")).toBe("mixed");
		fireEvent.click(row("独库公路"));
		expect(checked("旅行")).toBe("true");
		fireEvent.click(chevronOf("日常"));
		fireEvent.click(row("早餐"));
		expect(checked("日常")).toBe("true");
		expect(checked("2025")).toBe("true");
		expect(row("2025").querySelector(".v-tree-select__box")?.getAttribute("data-state")).toBe(
			"all",
		);
	});

	it("目录已全选再点一次，全部取消；部分选中再点，全部选上", () => {
		const onValueChange = vi.fn();
		render(<Multi defaultValue={["spring"]} onValueChange={onValueChange} />);
		openByClick();
		expect(checked("季节")).toBe("mixed");
		fireEvent.click(row("季节"));
		expect(onValueChange).toHaveBeenLastCalledWith(["spring", "summer", "autumn", "winter"]);
		fireEvent.click(row("季节"));
		expect(onValueChange).toHaveBeenLastCalledWith([]);
	});

	it("键盘：Enter 与 Space 勾选高亮行，不收起；→ ← 照常展开收起", () => {
		const onValueChange = vi.fn();
		render(<Multi onValueChange={onValueChange} />);
		trigger().focus();
		press("ArrowDown");
		press("End");
		press("Enter");
		expect(onValueChange).toHaveBeenLastCalledWith(["avatar"]);
		press("Home");
		press("ArrowRight");
		press("ArrowRight");
		expect(activeLabel()).toBe("旅行");
		press(" ");
		expect(onValueChange).toHaveBeenLastCalledWith(["avatar", "duku", "qinghai"]);
		expect(tree()).not.toBeNull();
	});

	it("芯片只列「覆盖最少节点」：选满的目录只显示目录名，超过 2 个折成 +N", () => {
		render(<Multi defaultValue={["duku", "qinghai", "spring", "avatar"]} />);
		const chips = () =>
			[...document.querySelectorAll(".v-tree-select__chip")].map((chip) => chip.textContent);
		expect(chips()).toEqual(["旅行", "春", "+1"]);
		cleanup();
		render(
			<Multi
				defaultValue={["duku", "qinghai", "spring", "summer", "autumn", "winter"]}
				maxChips={5}
			/>,
		);
		expect(chips()).toEqual(["旅行", "2026"]);
	});

	it("有选择时展开钮不显示占位", () => {
		render(<Multi defaultValue={["avatar"]} />);
		expect(trigger().querySelector("[data-placeholder]")).toBeNull();
	});

	it("移除钮取消该芯片覆盖的全部叶子并留在组件里；清除全部清空", () => {
		const onValueChange = vi.fn();
		render(
			<Multi
				defaultValue={["duku", "qinghai", "avatar"]}
				maxChips={3}
				onValueChange={onValueChange}
			/>,
		);
		trigger().focus();
		fireEvent.click(screen.getByRole("button", { name: "移除 旅行", hidden: true }));
		expect(onValueChange).toHaveBeenLastCalledWith(["avatar"]);
		expect(document.activeElement).toBe(trigger());
		fireEvent.click(screen.getByRole("button", { name: "清除全部", hidden: true }));
		expect(onValueChange).toHaveBeenLastCalledWith([]);
		expect(trigger().textContent).toBe("选择目录");
		expect(screen.queryByRole("button", { name: "清除全部", hidden: true })).toBeNull();
	});

	it("disabled 时没有移除钮与清除全部", () => {
		render(<Multi defaultValue={["avatar"]} disabled />);
		expect(screen.queryByRole("button", { name: /移除|清除/, hidden: true })).toBeNull();
	});

	it("树里找不到的值也列成芯片，可以移除", () => {
		const onValueChange = vi.fn();
		render(<Multi defaultValue={["ghost"]} onValueChange={onValueChange} />);
		expect(document.querySelector(".v-tree-select__chip")?.textContent).toBe("ghost");
		fireEvent.click(screen.getByRole("button", { name: "移除 ghost", hidden: true }));
		expect(onValueChange).toHaveBeenLastCalledWith([]);
	});

	it("点击外壳空白处展开，面板锚定整个外壳；id 与 aria 属性落在展开钮上", () => {
		render(<Multi id="folders" aria-describedby="hint" defaultValue={["avatar"]} />);
		expect(trigger().id).toBe("folders");
		expect((trigger().getAttribute("aria-describedby") ?? "").split(" ")[0]).toBe("hint");
		const shell = trigger().parentElement as HTMLElement;
		fireEvent.click(shell);
		expect(tree()).not.toBeNull();
	});

	it("禁用叶子不会被目录的勾选动到，已选的禁用叶子保留", () => {
		const options: TreeSelectOption[] = [
			{
				value: "d",
				label: "目录",
				children: [
					{ value: "a", label: "甲" },
					{ value: "b", label: "乙", disabled: true },
				],
			},
		];
		const onValueChange = vi.fn();
		render(<Multi options={options} onValueChange={onValueChange} defaultExpanded={["d"]} />);
		openByClick();
		fireEvent.click(row("目录"));
		expect(onValueChange).toHaveBeenLastCalledWith(["a"]);
		expect(checked("目录")).toBe("true");
		fireEvent.click(row("乙"));
		expect(onValueChange).toHaveBeenCalledTimes(1);
	});
});

describe("TreeSelect 搜索", () => {
	const input = () => screen.getByRole("combobox") as HTMLInputElement;

	it("触发器变成输入框：role=combobox、aria-autocomplete=list，带搜索图标", () => {
		render(<Fixture searchable placeholder="搜索目录" />);
		expect(input().tagName).toBe("INPUT");
		expect(input().getAttribute("aria-autocomplete")).toBe("list");
		expect(input().getAttribute("aria-haspopup")).toBe("tree");
		expect(input().placeholder).toBe("搜索目录");
		expect(
			input().closest(".v-input-control")?.querySelector(".v-input-control__leading"),
		).not.toBeNull();
	});

	it("输入过滤：只留匹配节点与祖先，祖先自动展开，匹配字高亮", () => {
		render(<Fixture searchable />);
		fireEvent.change(input(), { target: { value: "春" } });
		expect(tree()).not.toBeNull();
		expect(rowNames()).toEqual(["20264", "季节", "春"]);
		expect(row("2026").getAttribute("aria-expanded")).toBe("true");
		expect(row("季节").getAttribute("aria-expanded")).toBe("true");
		expect(row("春").querySelector("mark")?.textContent).toBe("春");
		expect(activeLabel()).toBe("2026");
	});

	it("不分大小写、匹配任意一级；无匹配显示「无匹配节点」", () => {
		render(
			<Fixture
				searchable
				options={[
					{ value: "a", label: "Alpha", children: [{ value: "b", label: "Beta" }] },
				]}
			/>,
		);
		fireEvent.change(input(), { target: { value: "BET" } });
		expect(rowNames()).toEqual(["Alpha", "Beta"]);
		fireEvent.change(input(), { target: { value: "zzz" } });
		expect(rows()).toHaveLength(0);
		expect(screen.getByText("无匹配节点")).not.toBeNull();
		expect(document.querySelector("[role=tree]")?.hasAttribute("hidden")).toBe(true);
	});

	it("清空搜索词后恢复原来记着的展开状态", () => {
		render(<Fixture searchable />);
		fireEvent.click(input());
		fireEvent.click(chevronOf("2025"));
		fireEvent.change(input(), { target: { value: "春" } });
		expect(rowNames()).toEqual(["20264", "季节", "春"]);
		fireEvent.change(input(), { target: { value: "" } });
		expect(rowNames()).toEqual(["2025", "旅行", "日常", "20264", "头像"]);
	});

	it("搜索中箭头钮不动；有搜索词时 ← → Home End 留给光标，↑ ↓ Enter 照常", async () => {
		const onValueChange = vi.fn();
		render(<Fixture searchable onValueChange={onValueChange} />);
		fireEvent.change(input(), { target: { value: "季" } });
		fireEvent.click(chevronOf("季节"));
		expect(rowNames()).toEqual(["20264", "季节"]);
		const before = activeLabel();
		for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
			const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
			act(() => {
				input().dispatchEvent(event);
			});
			expect(event.defaultPrevented).toBe(false);
		}
		expect(activeLabel()).toBe(before);
		press("ArrowDown", input());
		expect(activeLabel()).toBe("季节");
		press("Enter", input());
		await waitFor(() => expect(tree()).toBeNull());
		expect(onValueChange).toHaveBeenCalledWith("season");
	});

	it("搜索中 Space 是输入空格，不选中", () => {
		const onValueChange = vi.fn();
		render(<Fixture searchable onValueChange={onValueChange} />);
		fireEvent.change(input(), { target: { value: "春" } });
		const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
		act(() => {
			input().dispatchEvent(event);
		});
		expect(event.defaultPrevented).toBe(false);
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("关闭时输入框显示已选路径，打开后显示搜索词；关闭清掉搜索词", async () => {
		render(<Fixture searchable defaultValue="spring" />);
		expect(input().value).toBe("2026 / 季节 / 春");
		fireEvent.click(input());
		expect(input().value).toBe("");
		fireEvent.change(input(), { target: { value: "夏" } });
		expect(input().value).toBe("夏");
		press("Escape", input());
		await waitFor(() => expect(tree()).toBeNull());
		expect(input().value).toBe("2026 / 季节 / 春");
	});

	it("关闭态输入框里显示着已选路径时，直接打字只算新打的字", () => {
		render(<Fixture searchable defaultValue="spring" />);
		fireEvent.change(input(), { target: { value: "2026 / 季节 / 春夏" } });
		expect(tree()).not.toBeNull();
		expect(input().value).toBe("夏");
		expect(rowNames()).toEqual(["20264", "季节", "夏"]);
	});

	it("清除钮清空选择与搜索词", () => {
		const onValueChange = vi.fn();
		render(<Fixture searchable defaultValue="spring" onValueChange={onValueChange} />);
		fireEvent.click(screen.getByRole("button", { name: "清除", hidden: true }));
		expect(onValueChange).toHaveBeenCalledWith("");
		expect(input().value).toBe("");
	});

	it("↓ 在输入框里展开；Enter 在关闭态不展开", () => {
		render(<Fixture searchable />);
		press("Enter", input());
		expect(tree()).toBeNull();
		press("ArrowDown", input());
		expect(tree()).not.toBeNull();
	});

	it("多选可搜索：芯片之后是搜索输入，勾选后搜索词保留", () => {
		const onValueChange = vi.fn();
		render(<Multi searchable defaultValue={["avatar"]} onValueChange={onValueChange} />);
		expect(input().tagName).toBe("INPUT");
		fireEvent.change(input(), { target: { value: "夏" } });
		fireEvent.click(row("夏"));
		expect(onValueChange).toHaveBeenLastCalledWith(["avatar", "summer"]);
		expect(input().value).toBe("夏");
		expect(rowNames()).toEqual(["20264", "季节", "夏"]);
	});
});

describe("TreeSelect 懒加载", () => {
	const lazyOptions: TreeSelectOption[] = [
		{ value: "remote", label: "远程", lazy: true },
		{ value: "local", label: "本地" },
	];

	it("首次展开：箭头换成指示器，取回成功后子节点出现，已取回的不再取", async () => {
		const pending = deferred<TreeSelectOption[]>();
		const loadChildren = vi.fn(() => pending.promise);
		render(<Fixture options={lazyOptions} loadChildren={loadChildren} />);
		openByClick();
		expect(row("远程").getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(chevronOf("远程"));
		fireEvent.click(chevronOf("远程"));
		expect(loadChildren).toHaveBeenCalledTimes(1);
		expect(loadChildren).toHaveBeenCalledWith(lazyOptions[0]);
		expect(row("远程").querySelector(".v-spinner")).not.toBeNull();
		expect(row("远程").getAttribute("aria-busy")).toBe("true");
		expect(row("远程").getAttribute("aria-expanded")).toBe("true");
		await act(async () => {
			pending.resolve([{ value: "r1", label: "子项" }]);
			await pending.promise;
		});
		expect(rowNames()).toEqual(["远程", "子项", "本地"]);
		expect(row("子项").getAttribute("aria-level")).toBe("2");
		expect(row("远程").querySelector(".v-spinner")).toBeNull();
		fireEvent.click(chevronOf("远程"));
		expect(rowNames()).toEqual(["远程", "本地"]);
		fireEvent.click(chevronOf("远程"));
		expect(rowNames()).toEqual(["远程", "子项", "本地"]);
		expect(loadChildren).toHaveBeenCalledTimes(1);
	});

	it("失败：行变危险色并提示，点这一行重试，重试成功后恢复", async () => {
		const loadChildren = vi
			.fn<(option: TreeSelectOption) => Promise<TreeSelectOption[]>>()
			.mockRejectedValueOnce(new Error("网络"))
			.mockResolvedValueOnce([{ value: "r1", label: "子项" }]);
		render(<Fixture options={lazyOptions} loadChildren={loadChildren} />);
		openByClick();
		fireEvent.click(chevronOf("远程"));
		await settle();
		expect(row("远程").hasAttribute("data-failed")).toBe(true);
		expect(row("远程").getAttribute("aria-expanded")).toBe("false");
		expect(row("远程").textContent).toContain("加载失败，点击重试");
		expect(rowNames()).toEqual(["远程加载失败，点击重试", "本地"]);
		fireEvent.click(row("远程"));
		await settle();
		expect(loadChildren).toHaveBeenCalledTimes(2);
		expect(row("远程").hasAttribute("data-failed")).toBe(false);
		expect(rowNames()).toEqual(["远程", "子项", "本地"]);
	});

	it("loadChildren 同步抛错同样算失败", async () => {
		const loadChildren = vi.fn(() => {
			throw new Error("同步");
		});
		render(<Fixture options={lazyOptions} loadChildren={loadChildren as never} />);
		openByClick();
		fireEvent.click(chevronOf("远程"));
		await settle();
		expect(row("远程").hasAttribute("data-failed")).toBe(true);
	});

	it("键盘 → 触发取回，取回后再按 → 进入第一个子项", async () => {
		const loadChildren = vi.fn(async () => [{ value: "r1", label: "子项" }]);
		render(<Fixture options={lazyOptions} loadChildren={loadChildren} />);
		trigger().focus();
		press("ArrowDown");
		press("ArrowRight");
		await settle();
		expect(loadChildren).toHaveBeenCalledTimes(1);
		expect(rowNames()).toEqual(["远程", "子项", "本地"]);
		press("ArrowRight");
		expect(activeLabel()).toBe("子项");
	});

	it("多选里点未取回的目录行是取回，取回后才能勾选", async () => {
		const loadChildren = vi.fn(async () => [
			{ value: "r1", label: "子项一" },
			{ value: "r2", label: "子项二" },
		]);
		const onValueChange = vi.fn();
		render(
			<Multi
				options={lazyOptions}
				loadChildren={loadChildren}
				onValueChange={onValueChange}
			/>,
		);
		openByClick();
		expect(checked("远程")).toBe("false");
		fireEvent.click(row("远程"));
		await settle();
		expect(onValueChange).not.toHaveBeenCalled();
		expect(loadChildren).toHaveBeenCalledTimes(1);
		fireEvent.click(row("远程"));
		expect(onValueChange).toHaveBeenLastCalledWith(["r1", "r2"]);
		expect(checked("远程")).toBe("true");
	});

	it("没有 loadChildren 时 lazy 节点按叶子处理", () => {
		render(<Fixture options={lazyOptions} />);
		openByClick();
		expect(within(row("远程")).queryByRole("button", { hidden: true })).toBeNull();
	});

	it("取回的节点参与搜索", async () => {
		const loadChildren = vi.fn(async () => [{ value: "r1", label: "子项" }]);
		render(<Fixture searchable options={lazyOptions} loadChildren={loadChildren} />);
		fireEvent.click(screen.getByRole("combobox"));
		fireEvent.click(chevronOf("远程"));
		await settle();
		fireEvent.change(screen.getByRole("combobox"), { target: { value: "子" } });
		expect(rowNames()).toEqual(["远程", "子项"]);
	});

	it("卸载后取回完成不报错", async () => {
		const pending = deferred<TreeSelectOption[]>();
		const { unmount } = render(
			<Fixture options={lazyOptions} loadChildren={() => pending.promise} />,
		);
		openByClick();
		fireEvent.click(chevronOf("远程"));
		unmount();
		await act(async () => {
			pending.resolve([]);
			await pending.promise;
		});
	});
});

describe("TreeSelect 表单", () => {
	it("给了 name 才渲染隐藏输入；单选没选时提交空串，disabled 时不提交", () => {
		const { container, rerender } = render(
			<form>
				<Fixture defaultValue="avatar" />
			</form>,
		);
		expect(container.querySelector("input")).toBeNull();
		rerender(
			<form>
				<Fixture key="b" name="folder" defaultValue="avatar" />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		expect(new FormData(form).get("folder")).toBe("avatar");
		rerender(
			<form>
				<Fixture key="c" name="folder" />
			</form>,
		);
		expect(new FormData(form).get("folder")).toBe("");
		rerender(
			<form>
				<Fixture key="d" name="folder" defaultValue="avatar" disabled />
			</form>,
		);
		expect(new FormData(form).has("folder")).toBe(false);
	});

	it("多选每个叶子一个隐藏输入，没选不提交", () => {
		const { container, rerender } = render(
			<form>
				<Multi key="a" name="folder" defaultValue={["duku", "avatar"]} />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		expect(new FormData(form).getAll("folder")).toEqual(["duku", "avatar"]);
		rerender(
			<form>
				<Multi key="b" name="folder" />
			</form>,
		);
		expect(new FormData(form).has("folder")).toBe(false);
	});

	it("表单 reset 回到 defaultValue，没给则回到空", async () => {
		const { container } = render(
			<form>
				<Fixture name="folder" defaultValue="avatar" />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		openByClick();
		fireEvent.click(row("2025"));
		await waitFor(() => expect(new FormData(form).get("folder")).toBe("2025"));
		act(() => form.reset());
		await waitFor(() => expect(new FormData(form).get("folder")).toBe("avatar"));
		expect(trigger().textContent).toBe("头像");
	});

	it("多选 reset 回到 defaultValue", async () => {
		const { container } = render(
			<form>
				<Multi name="folder" defaultValue={["avatar"]} />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		openByClick();
		fireEvent.click(row("2025"));
		await waitFor(() =>
			expect(new FormData(form).getAll("folder")).toEqual([
				"avatar",
				"duku",
				"qinghai",
				"breakfast",
			]),
		);
		act(() => form.reset());
		await waitFor(() => expect(new FormData(form).getAll("folder")).toEqual(["avatar"]));
	});
});

describe("TreeSelect 面板挂载与渲染", () => {
	it("默认挂到 body，container 可改挂到指定容器", () => {
		const host = document.createElement("div");
		document.body.append(host);
		const { unmount } = render(<Fixture />);
		openByClick();
		expect(tree()?.closest("[data-slot=picker-panel]")?.parentElement?.parentElement).toBe(
			document.body,
		);
		unmount();
		render(<Fixture container={host} />);
		openByClick();
		expect(host.contains(tree())).toBe(true);
		host.remove();
	});

	it("服务端渲染不报错，单选、多选与可搜索都有触发器", () => {
		for (const ui of [
			<Fixture key="s" defaultValue="spring" />,
			<Multi key="m" defaultValue={["duku"]} />,
			<Fixture key="q" searchable defaultValue="spring" />,
			<Fixture key="o" defaultOpen />,
		]) {
			expect(() => renderToString(ui)).not.toThrow();
		}
		expect(renderToString(<Fixture defaultValue="spring" />)).toContain("春");
	});

	it("受控的 open 由调用方决定", async () => {
		function Host() {
			const [open, setOpen] = useState(false);
			return (
				<>
					<button type="button" onClick={() => setOpen(true)}>
						外部打开
					</button>
					<Fixture open={open} onOpenChange={setOpen} />
				</>
			);
		}
		render(<Host />);
		fireEvent.click(screen.getByRole("button", { name: "外部打开" }));
		expect(tree()).not.toBeNull();
		press("Escape");
		await waitFor(() => expect(tree()).toBeNull());
	});
});

describe("TreeSelect 审查修订", () => {
	it("芯片的移除钮也移除已选中的禁用叶子", () => {
		const onValueChange = vi.fn();
		const options: TreeSelectOption[] = [
			{
				value: "d",
				label: "目录",
				children: [
					{ value: "a", label: "甲" },
					{ value: "b", label: "乙", disabled: true },
				],
			},
		];
		render(<Multi options={options} defaultValue={["a", "b"]} onValueChange={onValueChange} />);
		fireEvent.click(screen.getByRole("button", { name: "移除 目录", hidden: true }));
		expect(onValueChange).toHaveBeenLastCalledWith([]);
	});

	it("清除全部可以 Tab 到达，清除后焦点回展开钮并卸载", async () => {
		render(
			<>
				<Multi defaultValue={["avatar"]} />
				<button type="button">下一个</button>
			</>,
		);
		trigger().focus();
		const clear = screen.getByRole("button", { name: "清除全部" });
		expect(clear.tabIndex).toBe(0);
		fireEvent.click(clear);
		await waitFor(() => expect(screen.queryByRole("button", { name: "清除全部" })).toBeNull());
		expect(document.activeElement).toBe(trigger());
	});

	it("搜索形态的清除钮可以 Tab 到达", () => {
		render(<Fixture searchable defaultValue="spring" />);
		expect(screen.getByRole("button", { name: "清除" }).tabIndex).toBe(0);
	});

	it("多选收起后 aria-describedby 带已选摘要，与调用方的取并集", () => {
		render(<Multi aria-describedby="hint" defaultValue={["duku", "qinghai", "avatar"]} />);
		const parts = (trigger().getAttribute("aria-describedby") ?? "").split(" ");
		expect(parts[0]).toBe("hint");
		const summary = document.getElementById(parts[1] ?? "");
		expect(summary?.textContent).toBe("已选 旅行、头像");
		expect(summary?.className).toContain("v-tree-select__sr");
	});

	it("多选已选项超过 2 个时摘要是「等 N 项」", () => {
		render(<Multi defaultValue={["duku", "qinghai", "spring", "avatar"]} />);
		const parts = (trigger().getAttribute("aria-describedby") ?? "").split(" ");
		expect(document.getElementById(parts[0] ?? "")?.textContent).toBe("已选 旅行、春 等 3 项");
	});

	it("没有 aria-label、aria-labelledby 与 id 时用占位文案兜底命名", () => {
		const { rerender } = render(
			<TreeSelect multiple options={OPTIONS} placeholder="选择目录" />,
		);
		expect(
			document.getElementById(trigger().getAttribute("aria-labelledby") ?? "")?.textContent,
		).toBe("选择目录");
		rerender(<TreeSelect options={OPTIONS} placeholder="选择目录" />);
		expect(
			document.getElementById(trigger().getAttribute("aria-labelledby") ?? "")?.textContent,
		).toBe("选择目录");
		cleanup();
		render(<TreeSelect searchable options={OPTIONS} placeholder="搜索目录" />);
		expect(trigger().getAttribute("aria-label")).toBe("搜索目录");
	});

	it("受控且没给 defaultValue：reset 通知调用方回空值", async () => {
		const onValueChange = vi.fn();
		const { container } = render(
			<form>
				<Multi value={["avatar"]} onValueChange={onValueChange} />
			</form>,
		);
		act(() => (container.querySelector("form") as HTMLFormElement).reset());
		await waitFor(() => expect(onValueChange).toHaveBeenCalledWith([]));
	});

	it("form 属性指到外置表单：清空后的多选也能响应 reset", async () => {
		const external = document.createElement("form");
		external.id = "remote-form";
		document.body.append(external);
		const { unmount } = render(
			<Multi form="remote-form" name="folder" defaultValue={["avatar"]} />,
		);
		fireEvent.click(screen.getByRole("button", { name: "清除全部", hidden: true }));
		await waitFor(() => expect(new FormData(external).getAll("folder")).toEqual([]));
		// 隐藏输入已全部卸载，reset 监听仍挂在表单上
		act(() => external.reset());
		await waitFor(() => expect(new FormData(external).getAll("folder")).toEqual(["avatar"]));
		unmount();
		external.remove();
	});

	it("换了 options 后旧懒加载缓存不再显示，旧请求晚返回也不写回", async () => {
		const pending = deferred<TreeSelectOption[]>();
		const loadChildren = vi.fn(() => pending.promise);
		const base = {
			"aria-label": "素材目录",
			placeholder: "选择目录",
			loadChildren,
		} as const;
		const { rerender } = render(
			<TreeSelect {...base} options={[{ value: "remote", label: "远程", lazy: true }]} />,
		);
		openByClick();
		fireEvent.click(chevronOf("远程"));
		// 面板一直开着：换数据源后旧缓存清空，同一节点重新等待取回
		rerender(
			<TreeSelect
				{...base}
				options={[{ value: "remote", label: "远程（新）", lazy: true }]}
			/>,
		);
		await act(async () => {});
		expect(row("远程（新）").querySelector(".v-spinner")).toBeNull();
		expect(row("远程（新）").getAttribute("aria-expanded")).toBe("false");
		// 旧请求晚返回也不写回新树
		await act(async () => {
			pending.resolve([{ value: "old", label: "旧子项" }]);
			await pending.promise;
		});
		expect(rowNames()).toEqual(["远程（新）"]);
		fireEvent.click(chevronOf("远程（新）"));
		expect(loadChildren).toHaveBeenCalledTimes(2);
	});
});
