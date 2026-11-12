import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../dialog";
import { Field } from "../../field";
import { Cascader, type CascaderOption, type CascaderProps } from "../cascader";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

const TREE: CascaderOption[] = [
	{
		value: "tech",
		label: "技术",
		children: [
			{
				value: "fe",
				label: "前端",
				children: [
					{ value: "react", label: "React 组件" },
					{ value: "css", label: "样式" },
				],
			},
			{ value: "be", label: "后端", children: [{ value: "go", label: "Go 服务" }] },
			{
				value: "tools",
				label: "工具",
				disabled: true,
				children: [{ value: "x", label: "X" }],
			},
		],
	},
	{
		value: "life",
		label: "随笔",
		children: [
			{ value: "ride", label: "骑行", children: [{ value: "road", label: "独库公路" }] },
		],
	},
	{ value: "solo", label: "单页" },
	{
		value: "deep",
		label: "专栏",
		children: [
			{
				value: "series",
				label: "系列",
				children: [
					{
						value: "chapter",
						label: "章节",
						children: [{ value: "section", label: "小节" }],
					},
				],
			},
		],
	},
];

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const trigger = () => screen.getByRole("combobox");
const tree = () => screen.queryByRole("tree");
const row = (name: string) => screen.getByRole("treeitem", { name });
const queryRow = (name: string) => screen.queryByRole("treeitem", { name });
const press = (key: string, target: Element = trigger()) => fireEvent.keyDown(target, { key });
const openByClick = () => fireEvent.click(trigger());
const activeRow = () => {
	const id = trigger().getAttribute("aria-activedescendant");
	return id ? document.getElementById(id) : null;
};
const columns = () =>
	screen.queryAllByRole("group").filter((el) => el.matches("[data-slot=cascader-column]"));

/** 一个由测试手动完成的 loadData。 */
function deferredLoad() {
	let resolve: (nodes: CascaderOption[]) => void = () => {};
	const loadData = vi.fn(
		(_path: readonly CascaderOption[]) =>
			new Promise<CascaderOption[]>((done) => {
				resolve = done;
			}),
	);
	return { loadData, resolve: (nodes: CascaderOption[]) => resolve(nodes) };
}

function Fixture(props: Partial<CascaderProps>) {
	return <Cascader aria-label="发布位置" options={TREE} {...props} />;
}

function Controlled(props: Partial<CascaderProps> & { onChange?: (path: string[]) => void }) {
	const { onChange, ...rest } = props;
	const [value, setValue] = useState<string[]>([]);
	return (
		<Fixture
			{...rest}
			value={value}
			onValueChange={(path) => {
				setValue(path);
				onChange?.(path);
			}}
		/>
	);
}

describe("Cascader 触发器", () => {
	it("是带 combobox、haspopup=tree、expanded、controls 的按钮，焦点留在触发器上", () => {
		render(<Fixture />);
		expect(trigger().tagName).toBe("BUTTON");
		expect(trigger().getAttribute("aria-haspopup")).toBe("tree");
		expect(trigger().getAttribute("aria-expanded")).toBe("false");
		expect(trigger().getAttribute("aria-controls")).toBeTruthy();
		expect(trigger().textContent).toBe("请选择");

		trigger().focus();
		openByClick();
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
		expect(tree()?.id).toBe(trigger().getAttribute("aria-controls"));
		expect(tree()?.getAttribute("aria-label")).toBe("发布位置");
		expect(document.activeElement).toBe(trigger());
	});

	it("选中后显示完整路径，分隔符单独成节点", () => {
		render(<Fixture defaultValue={["tech", "fe", "react"]} />);
		expect(trigger().textContent).toBe("技术 / 前端 / React 组件");
		expect(trigger().querySelectorAll(".v-cascader-sep")).toHaveLength(2);
		expect(trigger().hasAttribute("title")).toBe(false);
	});

	it("多于三级折成「首级 / … / 末级」，完整路径在 title 与读屏文字里", () => {
		render(<Fixture defaultValue={["deep", "series", "chapter", "section"]} />);
		const visible = trigger().querySelector("[aria-hidden=true]");
		expect(visible?.textContent).toBe("专栏 / … / 小节");
		expect(trigger().getAttribute("title")).toBe("专栏 / 系列 / 章节 / 小节");
		expect(trigger().querySelector(".v-cascader-sr")?.textContent).toBe(
			"专栏 / 系列 / 章节 / 小节",
		);
		expect(screen.getByRole("combobox", { name: "发布位置" })).toBe(trigger());
	});

	it("三级及以下不折叠", () => {
		render(<Fixture defaultValue={["tech", "fe", "css"]} />);
		expect(trigger().textContent).toBe("技术 / 前端 / 样式");
	});

	it("受控值指向找不到的节点时，没解析到的层级显示它的 value", () => {
		render(<Fixture value={["tech", "ghost"]} />);
		expect(trigger().textContent).toBe("技术 / ghost");
	});

	it("透传 id、aria-describedby 与 aria-invalid，invalid 与 valid 给外壳属性", () => {
		const { rerender } = render(
			<>
				<p id="hint">必选</p>
				<Fixture id="place" aria-describedby="hint" aria-invalid />
			</>,
		);
		expect(trigger().id).toBe("place");
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

	it("loading 显示指示器并设 aria-busy；readOnly 不能展开且没有箭头；disabled 不能展开", () => {
		const { rerender } = render(<Fixture loading />);
		expect(trigger().getAttribute("aria-busy")).toBe("true");
		expect(trigger().querySelector(".v-spinner")).not.toBeNull();

		rerender(<Fixture readOnly />);
		openByClick();
		expect(tree()).toBeNull();
		expect(trigger().querySelector(".v-input-control__trailing")).toBeNull();
		expect(trigger().getAttribute("aria-readonly")).toBe("true");
		press("ArrowDown");
		expect(tree()).toBeNull();

		rerender(<Fixture disabled />);
		expect((trigger() as HTMLButtonElement).disabled).toBe(true);
	});

	it("在 Field 里：标签命中触发器，提示与错误经 aria-describedby 指向它", () => {
		render(
			<Field label="发布位置" hint="选一个" error="必须选择">
				<Cascader options={TREE} />
			</Field>,
		);
		expect(screen.getByLabelText("发布位置")).toBe(trigger());
		expect(trigger().getAttribute("aria-invalid")).toBe("true");
		const described = trigger().getAttribute("aria-describedby") ?? "";
		expect(described).toBeTruthy();
		expect(document.getElementById(described.split(" ")[0])?.textContent).toContain("必须选择");
	});

	it("服务端渲染不报错，并输出触发器", () => {
		const html = renderToString(<Fixture defaultValue={["tech", "fe", "css"]} name="place" />);
		expect(html).toContain("技术");
		expect(html).toContain('role="combobox"');
		expect(renderToString(<Fixture searchable />)).toContain("搜索路径");
	});
});

describe("Cascader 面板与点击", () => {
	it("面板是 tree，每列是 group，行是 treeitem，有子项的行带 aria-expanded 与 aria-level", () => {
		render(<Fixture />);
		openByClick();
		expect(columns()).toHaveLength(1);
		expect(row("技术").getAttribute("aria-expanded")).toBe("false");
		expect(row("技术").getAttribute("aria-level")).toBe("1");
		expect(row("单页").hasAttribute("aria-expanded")).toBe(false);

		fireEvent.click(row("技术"));
		expect(columns()).toHaveLength(2);
		expect(row("技术").getAttribute("aria-expanded")).toBe("true");
		expect(row("前端").getAttribute("aria-level")).toBe("2");
		expect(within(columns()[1]).getAllByRole("treeitem")).toHaveLength(3);
	});

	it("点有子项的行只展开不选中，面板保持打开；下一列内容随上一列即时替换", () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		openByClick();
		fireEvent.click(row("技术"));
		fireEvent.click(row("前端"));
		expect(columns()).toHaveLength(3);
		expect(onValueChange).not.toHaveBeenCalled();
		expect(trigger().getAttribute("aria-expanded")).toBe("true");

		fireEvent.click(row("随笔"));
		expect(columns()).toHaveLength(2);
		expect(queryRow("React 组件")).toBeNull();
		expect(row("骑行")).toBeTruthy();
	});

	it("点叶子选中、收起、还焦点，并给出路径与节点链", async () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		trigger().focus();
		openByClick();
		fireEvent.click(row("技术"));
		fireEvent.click(row("前端"));
		fireEvent.click(row("样式"));
		expect(onValueChange).toHaveBeenCalledTimes(1);
		const [path, nodes] = onValueChange.mock.calls[0];
		expect(path).toEqual(["tech", "fe", "css"]);
		expect((nodes as CascaderOption[]).map((node) => node.label)).toEqual([
			"技术",
			"前端",
			"样式",
		]);
		await waitFor(() => expect(tree()).toBeNull());
		expect(trigger().textContent).toBe("技术 / 前端 / 样式");
		expect(document.activeElement).toBe(trigger());
	});

	it("第一级就是叶子的行点一下就选中", () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		openByClick();
		fireEvent.click(row("单页"));
		expect(onValueChange).toHaveBeenCalledWith(["solo"], [TREE[2]]);
	});

	it("禁用行不能点，也没有展开", () => {
		render(<Fixture />);
		openByClick();
		fireEvent.click(row("技术"));
		fireEvent.click(row("工具"));
		expect(row("工具").getAttribute("aria-disabled")).toBe("true");
		expect(columns()).toHaveLength(2);
	});

	it("重新打开时面板回到已选路径：每一列展开，已选行 aria-selected", () => {
		render(<Fixture defaultValue={["tech", "fe", "css"]} />);
		openByClick();
		expect(columns()).toHaveLength(3);
		expect(row("样式").getAttribute("aria-selected")).toBe("true");
		expect(row("React 组件").getAttribute("aria-selected")).toBe("false");
		expect(row("前端").getAttribute("aria-expanded")).toBe("true");
		expect(activeRow()?.textContent).toBe("样式");
	});

	it("一开始就展开时，首帧就回到已选路径并有读屏光标", () => {
		render(<Fixture open defaultValue={["tech", "fe", "css"]} />);
		expect(columns()).toHaveLength(3);
		expect(activeRow()?.textContent).toBe("样式");
		expect(row("样式").getAttribute("aria-selected")).toBe("true");
	});

	it("defaultOpen 同样回到已选路径", () => {
		render(<Fixture defaultOpen defaultValue={["tech", "be", "go"]} />);
		expect(columns()).toHaveLength(3);
		expect(activeRow()?.textContent).toBe("Go 服务");
	});

	it("没有选项时第一列显示「无选项」，子级为空数组的行显示「没有子项」", () => {
		const { unmount } = render(<Fixture options={[]} />);
		openByClick();
		expect(screen.getByText("无选项")).toBeTruthy();
		unmount();

		render(<Fixture options={[{ value: "a", label: "甲", children: [] }]} />);
		openByClick();
		fireEvent.click(row("甲"));
		expect(screen.getByText("没有子项")).toBeTruthy();
	});

	it("再点触发器收起；点外部收起", async () => {
		render(
			<>
				<button type="button">外面</button>
				<Fixture />
			</>,
		);
		openByClick();
		expect(tree()).not.toBeNull();
		await settle();
		openByClick();
		await waitFor(() => expect(tree()).toBeNull());

		openByClick();
		await settle();
		fireEvent.pointerDown(screen.getByText("外面"), { pointerType: "mouse", button: 0 });
		fireEvent.pointerUp(screen.getByText("外面"), { pointerType: "mouse", button: 0 });
		fireEvent.click(screen.getByText("外面"));
		await waitFor(() => expect(tree()).toBeNull());
	});
});

describe("Cascader 悬停展开", () => {
	it("鼠标停在有子项的行上 120ms 后展开；中途移开不展开", async () => {
		render(<Fixture />);
		openByClick();
		fireEvent.pointerEnter(row("技术"), { clientX: 10, clientY: 10 });
		fireEvent.pointerLeave(row("技术"));
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(columns()).toHaveLength(1);

		fireEvent.pointerEnter(row("技术"), { clientX: 12, clientY: 12 });
		expect(columns()).toHaveLength(1);
		await waitFor(() => expect(columns()).toHaveLength(2));
		expect(row("技术").getAttribute("aria-expanded")).toBe("true");
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
	});

	it("悬停只展开，不选中", async () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} changeOnSelect />);
		openByClick();
		fireEvent.pointerEnter(row("技术"), { clientX: 10, clientY: 10 });
		await waitFor(() => expect(columns()).toHaveLength(2));
		expect(onValueChange).not.toHaveBeenCalled();
	});
});

describe("Cascader 悬停与光标", () => {
	it("指针悬停的行同步成读屏光标，不改展开路径与选值", () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		openByClick();
		fireEvent.pointerEnter(row("单页"), { clientX: 10, clientY: 10 });
		expect(trigger().getAttribute("aria-activedescendant")).toBe(row("单页").id);
		fireEvent.pointerEnter(row("随笔"), { clientX: 12, clientY: 30 });
		expect(trigger().getAttribute("aria-activedescendant")).toBe(row("随笔").id);
		expect(columns()).toHaveLength(1);
		expect(onValueChange).not.toHaveBeenCalled();
		// 悬停不叠加字重：只有展开路径与已选行加粗
		expect(row("单页").hasAttribute("data-selected")).toBe(false);
	});

	it("悬停计时未到就按键盘导航，计时结束后光标不回退", async () => {
		render(<Fixture />);
		trigger().focus();
		openByClick();
		fireEvent.pointerEnter(row("技术"), { clientX: 10, clientY: 10 });
		press("ArrowRight");
		expect(columns()).toHaveLength(2);
		expect(activeRow()?.textContent).toBe("前端");
		await new Promise((resolve) => setTimeout(resolve, 250));
		expect(activeRow()?.textContent).toBe("前端");
		expect(columns()).toHaveLength(2);
	});
});

describe("Cascader 键盘", () => {
	it("↓ 展开并高亮第一项；↑↓ 在当前列移动、跳过禁用项、不循环", () => {
		render(<Fixture />);
		trigger().focus();
		press("ArrowDown");
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
		expect(activeRow()?.textContent).toBe("技术");
		press("ArrowUp");
		expect(activeRow()?.textContent).toBe("技术");
		press("ArrowDown");
		expect(activeRow()?.textContent).toBe("随笔");
		press("End");
		expect(activeRow()?.textContent).toBe("专栏");
		press("ArrowDown");
		expect(activeRow()?.textContent).toBe("专栏");
		press("Home");
		expect(activeRow()?.textContent).toBe("技术");

		// 进入第二列后，禁用的「工具」被跳过
		press("ArrowRight");
		press("ArrowDown");
		press("ArrowDown");
		expect(activeRow()?.textContent).toBe("后端");
		press("ArrowDown");
		expect(activeRow()?.textContent).toBe("后端");
	});

	it("→ 进入下一列并落在第一项，← 回上一列，再 ← 在第一列无效", () => {
		render(<Fixture />);
		trigger().focus();
		press("Enter");
		expect(activeRow()?.textContent).toBe("技术");
		press("ArrowRight");
		expect(columns()).toHaveLength(2);
		expect(activeRow()?.textContent).toBe("前端");
		press("ArrowRight");
		expect(columns()).toHaveLength(3);
		expect(activeRow()?.textContent).toBe("React 组件");
		press("ArrowRight");
		expect(activeRow()?.textContent).toBe("React 组件");

		press("ArrowLeft");
		expect(activeRow()?.textContent).toBe("前端");
		expect(row("前端").getAttribute("aria-expanded")).toBe("true");
		press("ArrowLeft");
		expect(activeRow()?.textContent).toBe("技术");
		press("ArrowLeft");
		expect(activeRow()?.textContent).toBe("技术");
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
	});

	it("Enter 与 Space 在有子项的行上进入下一列，在叶子上选中并收起", async () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		trigger().focus();
		press("ArrowDown");
		press("Enter");
		expect(activeRow()?.textContent).toBe("前端");
		expect(onValueChange).not.toHaveBeenCalled();
		press(" ");
		expect(activeRow()?.textContent).toBe("React 组件");
		press("ArrowDown");
		press("Enter");
		expect(onValueChange).toHaveBeenCalledWith(["tech", "fe", "css"], expect.any(Array));
		await waitFor(() => expect(tree()).toBeNull());
		expect(document.activeElement).toBe(trigger());
	});

	it("Space 选中叶子并收起", async () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		trigger().focus();
		press("ArrowDown");
		press("End");
		press("ArrowUp");
		expect(activeRow()?.textContent).toBe("单页");
		press(" ");
		expect(onValueChange).toHaveBeenCalledWith(["solo"], expect.any(Array));
		await waitFor(() => expect(tree()).toBeNull());
	});

	it("Esc 收起，值不变，焦点还在触发器", async () => {
		render(<Fixture defaultValue={["solo"]} />);
		trigger().focus();
		press("Enter");
		press("ArrowDown");
		press("Escape");
		await waitFor(() => expect(tree()).toBeNull());
		expect(trigger().textContent).toBe("单页");
		expect(document.activeElement).toBe(trigger());
	});

	it("Tab 收起并放行去下一个控件，不把焦点抢回触发器", async () => {
		render(
			<>
				<Fixture />
				<button type="button">下一个</button>
			</>,
		);
		trigger().focus();
		press("Enter");
		press("Tab");
		await waitFor(() => expect(tree()).toBeNull());
		const next = screen.getByText("下一个");
		next.focus();
		expect(document.activeElement).toBe(next);
	});

	it("在 Dialog 里 Esc 只收起面板，不关 Dialog", async () => {
		render(
			<Dialog defaultOpen>
				<DialogContent>
					<DialogTitle>编辑</DialogTitle>
					<DialogDescription>选择发布位置</DialogDescription>
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

	it("输入法组合期间不响应方向键与 Enter", () => {
		render(<Fixture />);
		trigger().focus();
		fireEvent.keyDown(trigger(), { key: "Enter", isComposing: true });
		expect(tree()).toBeNull();
	});
});

describe("Cascader changeOnSelect", () => {
	it("每一级都能选：点一次展开并选中，路径显示到当前这一级，面板保持打开", () => {
		const onValueChange = vi.fn();
		render(<Fixture changeOnSelect onValueChange={onValueChange} />);
		openByClick();
		fireEvent.click(row("技术"));
		expect(onValueChange).toHaveBeenLastCalledWith(["tech"], expect.any(Array));
		expect(trigger().textContent).toBe("技术");
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
		expect(columns()).toHaveLength(2);

		fireEvent.click(row("前端"));
		expect(trigger().textContent).toBe("技术 / 前端");
		expect(onValueChange).toHaveBeenLastCalledWith(["tech", "fe"], expect.any(Array));
	});

	it("再点已选中的行取消选择，行仍保持展开", () => {
		const onValueChange = vi.fn();
		render(<Fixture changeOnSelect defaultValue={["tech"]} onValueChange={onValueChange} />);
		openByClick();
		expect(row("技术").getAttribute("aria-selected")).toBe("true");
		fireEvent.click(row("技术"));
		expect(onValueChange).toHaveBeenLastCalledWith([], []);
		expect(trigger().textContent).toBe("请选择");
		expect(row("技术").getAttribute("aria-selected")).toBe("false");
		expect(row("技术").getAttribute("aria-expanded")).toBe("true");
	});

	it("Enter 选中有子项的行并收起，→ 才进入下一列", async () => {
		const onValueChange = vi.fn();
		render(<Fixture changeOnSelect onValueChange={onValueChange} />);
		trigger().focus();
		press("ArrowDown");
		press("ArrowRight");
		expect(activeRow()?.textContent).toBe("前端");
		expect(onValueChange).not.toHaveBeenCalled();
		press("Enter");
		expect(onValueChange).toHaveBeenCalledWith(["tech", "fe"], expect.any(Array));
		await waitFor(() => expect(tree()).toBeNull());
	});

	it("默认（不带 changeOnSelect）时有子项的行选不中", () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		openByClick();
		fireEvent.click(row("技术"));
		fireEvent.click(row("技术"));
		expect(onValueChange).not.toHaveBeenCalled();
	});
});

describe("Cascader 按需加载", () => {
	const lazyRoot: CascaderOption[] = [
		{ value: "a", label: "栏目" },
		{ value: "leaf", label: "单页", isLeaf: true },
	];
	const chapters: CascaderOption[] = [
		{ value: "c1", label: "第一章", isLeaf: true },
		{ value: "c2", label: "第二章", disabled: true, isLeaf: true },
	];

	it("首次展开：行显示指示器，列里显示「加载中…」；成功后列出现，已加载的不再请求", async () => {
		const { loadData, resolve } = deferredLoad();
		render(<Fixture options={lazyRoot} loadData={loadData} />);
		openByClick();
		expect(row("栏目").hasAttribute("aria-expanded")).toBe(true);
		expect(row("单页").hasAttribute("aria-expanded")).toBe(false);

		fireEvent.click(row("栏目"));
		expect(loadData).toHaveBeenCalledTimes(1);
		expect(loadData.mock.calls[0][0]).toEqual([lazyRoot[0]]);
		expect(row("栏目").getAttribute("aria-busy")).toBe("true");
		expect(row("栏目").querySelector(".v-spinner")).not.toBeNull();
		expect(screen.getByText("加载中…")).toBeTruthy();

		await act(async () => resolve(chapters));
		expect(screen.queryByText("加载中…")).toBeNull();
		expect(row("栏目").hasAttribute("aria-busy")).toBe(false);
		expect(columns()).toHaveLength(2);
		expect(row("第一章")).toBeTruthy();

		fireEvent.click(row("单页"));
		openByClick();
		fireEvent.click(row("栏目"));
		expect(loadData).toHaveBeenCalledTimes(1);
		expect(columns()).toHaveLength(2);
	});

	it("加载中重复点击不会重复请求", async () => {
		const { loadData, resolve } = deferredLoad();
		render(<Fixture options={lazyRoot} loadData={loadData} />);
		openByClick();
		fireEvent.click(row("栏目"));
		fireEvent.click(row("栏目"));
		expect(loadData).toHaveBeenCalledTimes(1);
		await act(async () => resolve(chapters));
	});

	it("失败：行变危险色并带读屏提示，点击重试；重试成功后列出现", async () => {
		const loadData = vi
			.fn<(path: readonly CascaderOption[]) => Promise<CascaderOption[]>>()
			.mockRejectedValueOnce(new Error("网络"))
			.mockResolvedValueOnce(chapters);
		render(<Fixture options={lazyRoot} loadData={loadData} />);
		openByClick();
		fireEvent.click(row("栏目"));
		await settle();
		const failed = screen.getByRole("treeitem", { name: /栏目.*加载失败，点击重试/ });
		expect(failed.hasAttribute("data-error")).toBe(true);
		expect(columns()).toHaveLength(1);

		fireEvent.click(failed);
		expect(loadData).toHaveBeenCalledTimes(2);
		await settle();
		expect(row("栏目").hasAttribute("data-error")).toBe(false);
		expect(columns()).toHaveLength(2);
		expect(row("第一章")).toBeTruthy();
	});

	it("→ 在未加载的行上发起加载，加载完落在第一个可用子项", async () => {
		const loadData = vi.fn().mockResolvedValue(chapters);
		render(<Fixture options={lazyRoot} loadData={loadData} />);
		trigger().focus();
		press("ArrowDown");
		press("ArrowRight");
		expect(loadData).toHaveBeenCalledTimes(1);
		await settle();
		expect(activeRow()?.textContent).toBe("第一章");
		press("Enter");
		expect(trigger().textContent).toBe("栏目 / 第一章");
	});

	it("加载出来的叶子可以被搜索到", async () => {
		const loadData = vi.fn().mockResolvedValue(chapters);
		render(<Fixture options={lazyRoot} loadData={loadData} searchable />);
		openByClick();
		fireEvent.click(row("栏目"));
		await settle();
		fireEvent.change(trigger(), { target: { value: "第一" } });
		expect(screen.getAllByRole("treeitem")).toHaveLength(1);
		expect(screen.getByRole("treeitem").textContent).toBe("栏目 / 第一章");
	});
});

describe("Cascader 搜索", () => {
	it("searchable 时触发器是带搜索图标的输入框，role=combobox", () => {
		render(<Fixture searchable />);
		expect(trigger().tagName).toBe("INPUT");
		expect(trigger().getAttribute("placeholder")).toBe("搜索路径");
		expect(trigger().getAttribute("aria-haspopup")).toBe("tree");
		expect(trigger().closest(".v-input-control")?.querySelector("svg")).not.toBeNull();
	});

	it("输入后列出匹配任意一级的完整路径，只列叶子，匹配字高亮", () => {
		render(<Fixture searchable />);
		trigger().focus();
		fireEvent.change(trigger(), { target: { value: "前端" } });
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
		const hits = screen.getAllByRole("treeitem");
		expect(hits.map((hit) => hit.textContent)).toEqual([
			"技术 / 前端 / React 组件",
			"技术 / 前端 / 样式",
		]);
		expect(hits[0].querySelector("mark")?.textContent).toBe("前端");

		fireEvent.change(trigger(), { target: { value: "react" } });
		expect(screen.getAllByRole("treeitem")).toHaveLength(1);
		expect(row("技术 / 前端 / React 组件")).toBeTruthy();
	});

	it("路径上有禁用节点的叶子不列出", () => {
		render(<Fixture searchable />);
		openByClick();
		fireEvent.change(trigger(), { target: { value: "工具" } });
		expect(screen.queryAllByRole("treeitem")).toHaveLength(0);
	});

	it("没有匹配时显示「无匹配的路径」", () => {
		render(<Fixture searchable />);
		openByClick();
		fireEvent.change(trigger(), { target: { value: "不存在" } });
		expect(screen.getByText("无匹配的路径")).toBeTruthy();
		expect(trigger().getAttribute("aria-activedescendant")).toBeNull();
		press("Enter");
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
	});

	it("Enter 选中高亮项：默认第一项，↑↓ 移动", async () => {
		const onValueChange = vi.fn();
		render(<Fixture searchable onValueChange={onValueChange} />);
		trigger().focus();
		fireEvent.change(trigger(), { target: { value: "前端" } });
		expect(activeRow()?.textContent).toBe("技术 / 前端 / React 组件");
		press("ArrowDown");
		expect(activeRow()?.textContent).toBe("技术 / 前端 / 样式");
		press("ArrowDown");
		expect(activeRow()?.textContent).toBe("技术 / 前端 / 样式");
		press("ArrowUp");
		press("ArrowUp");
		expect(activeRow()?.textContent).toBe("技术 / 前端 / React 组件");
		press("ArrowDown");
		press("Enter");
		expect(onValueChange).toHaveBeenCalledWith(["tech", "fe", "css"], expect.any(Array));
		await waitFor(() => expect(tree()).toBeNull());
		expect((trigger() as HTMLInputElement).value).toBe("技术 / 前端 / 样式");
		expect(document.activeElement).toBe(trigger());
	});

	it("点结果选中；输入框里不输入时空格不被拦截", async () => {
		const onValueChange = vi.fn();
		render(<Fixture searchable onValueChange={onValueChange} />);
		openByClick();
		fireEvent.change(trigger(), { target: { value: "骑行" } });
		fireEvent.click(row("随笔 / 骑行 / 独库公路"));
		expect(onValueChange).toHaveBeenCalledWith(["life", "ride", "road"], expect.any(Array));

		openByClick();
		const space = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
		trigger().dispatchEvent(space);
		expect(space.defaultPrevented).toBe(false);
	});

	it("打开时输入框不显示旧路径而是搜索词，旧路径放在占位里；清除钮清空选择", () => {
		const onValueChange = vi.fn();
		render(
			<Fixture
				searchable
				defaultValue={["tech", "fe", "css"]}
				onValueChange={onValueChange}
			/>,
		);
		expect((trigger() as HTMLInputElement).value).toBe("技术 / 前端 / 样式");
		openByClick();
		expect((trigger() as HTMLInputElement).value).toBe("");
		expect(trigger().getAttribute("placeholder")).toBe("技术 / 前端 / 样式");

		fireEvent.click(screen.getByRole("button", { name: "清除" }));
		expect(onValueChange).toHaveBeenCalledWith([], []);
		expect(screen.queryByRole("button", { name: "清除" })).toBeNull();
	});

	it("清除钮在 Tab 顺序里，键盘清除后焦点回到输入框", () => {
		const onValueChange = vi.fn();
		render(<Fixture searchable defaultValue={["solo"]} onValueChange={onValueChange} />);
		const clear = screen.getByRole("button", { name: "清除" });
		expect(clear.getAttribute("tabindex")).toBeNull();
		clear.focus();
		expect(document.activeElement).toBe(clear);
		fireEvent.click(clear);
		expect(onValueChange).toHaveBeenCalledWith([], []);
		expect(document.activeElement).toBe(trigger());
		expect((trigger() as HTMLInputElement).value).toBe("");
	});

	it("没有搜索词时仍是多列面板，键盘与普通形态一致", () => {
		render(<Fixture searchable />);
		trigger().focus();
		press("ArrowDown");
		press("ArrowRight");
		expect(columns()).toHaveLength(2);
		expect(activeRow()?.textContent).toBe("前端");
	});
});

describe("Cascader 值与表单", () => {
	it("受控：值由外部决定，选择只通知", () => {
		const onChange = vi.fn();
		render(<Fixture value={["solo"]} onValueChange={onChange} />);
		openByClick();
		fireEvent.click(row("技术"));
		fireEvent.click(row("后端"));
		fireEvent.click(row("Go 服务"));
		expect(onChange).toHaveBeenCalledWith(["tech", "be", "go"], expect.any(Array));
		expect(trigger().textContent).toBe("单页");
	});

	it("受控 + 回写：选择后显示新路径", async () => {
		render(<Controlled />);
		openByClick();
		fireEvent.click(row("技术"));
		fireEvent.click(row("后端"));
		fireEvent.click(row("Go 服务"));
		expect(trigger().textContent).toBe("技术 / 后端 / Go 服务");
	});

	it("选同一个路径不重复通知", () => {
		const onValueChange = vi.fn();
		render(<Fixture defaultValue={["solo"]} onValueChange={onValueChange} />);
		openByClick();
		fireEvent.click(row("单页"));
		expect(onValueChange).not.toHaveBeenCalled();
	});

	it("open 受控", async () => {
		const onOpenChange = vi.fn();
		const { rerender } = render(<Fixture open onOpenChange={onOpenChange} />);
		expect(tree()).not.toBeNull();
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
		expect(onOpenChange).toHaveBeenCalledWith(false);
		rerender(<Fixture open={false} onOpenChange={onOpenChange} />);
		await waitFor(() => expect(tree()).toBeNull());
	});

	it("name：每一级一个同名隐藏输入，按层级顺序", () => {
		const { container } = render(
			<form>
				<Fixture name="place" defaultValue={["tech", "fe", "css"]} />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		expect(new FormData(form).getAll("place")).toEqual(["tech", "fe", "css"]);
	});

	it("name：没有选择不提交；disabled 不提交", () => {
		const { container, unmount } = render(
			<form>
				<Fixture name="place" />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		expect(new FormData(form).getAll("place")).toEqual([]);
		unmount();

		const disabled = render(
			<form>
				<Fixture name="place" defaultValue={["solo"]} disabled />
			</form>,
		);
		const disabledForm = disabled.container.querySelector("form") as HTMLFormElement;
		expect(new FormData(disabledForm).getAll("place")).toEqual([]);
	});

	it("表单 reset 回到 defaultValue，没给则回到空", async () => {
		const { container } = render(
			<form>
				<Fixture name="place" defaultValue={["solo"]} />
			</form>,
		);
		openByClick();
		fireEvent.click(row("技术"));
		fireEvent.click(row("后端"));
		fireEvent.click(row("Go 服务"));
		expect(trigger().textContent).toBe("技术 / 后端 / Go 服务");
		act(() => (container.querySelector("form") as HTMLFormElement).reset());
		await settle();
		expect(trigger().textContent).toBe("单页");
	});
});

describe("Cascader 外置表单复位", () => {
	it("按 form id 定位表单：值清空后隐藏输入卸载，复位仍回到 defaultValue", async () => {
		render(
			<>
				<form id="ext" />
				<Fixture form="ext" name="place" changeOnSelect defaultValue={["tech"]} />
			</>,
		);
		openByClick();
		fireEvent.click(row("技术"));
		expect(trigger().textContent).toBe("请选择");
		expect(document.querySelectorAll('input[type="hidden"][name="place"]')).toHaveLength(0);
		act(() => (document.getElementById("ext") as HTMLFormElement).reset());
		await settle();
		expect(trigger().textContent).toBe("技术");
	});

	it("受控：没有 defaultValue 时复位回写空路径", async () => {
		const onValueChange = vi.fn();
		render(
			<form>
				<Fixture value={["solo"]} onValueChange={onValueChange} />
			</form>,
		);
		act(() => (document.querySelector("form") as HTMLFormElement).reset());
		await settle();
		expect(onValueChange).toHaveBeenCalledWith([], []);
	});

	it("受控：有 defaultValue 时复位回写它", async () => {
		const onValueChange = vi.fn();
		render(
			<form>
				<Fixture
					value={["solo"]}
					defaultValue={["tech", "be", "go"]}
					onValueChange={onValueChange}
				/>
			</form>,
		);
		act(() => (document.querySelector("form") as HTMLFormElement).reset());
		await settle();
		expect(onValueChange).toHaveBeenCalledWith(["tech", "be", "go"], expect.any(Array));
	});
});

describe("Cascader 触屏", () => {
	it("粗指针下只显示当前一级，顶部「‹ 返回」回到上一级", () => {
		const original = window.matchMedia;
		window.matchMedia = ((query: string) => ({
			matches: query === "(pointer: coarse)",
			media: query,
			addEventListener: () => {},
			removeEventListener: () => {},
		})) as unknown as typeof window.matchMedia;
		try {
			render(<Fixture />);
			openByClick();
			expect(columns()).toHaveLength(1);
			expect(screen.queryByRole("button", { name: /返回/ })).toBeNull();

			fireEvent.click(row("技术"));
			expect(columns()).toHaveLength(1);
			expect(queryRow("技术")).toBeNull();
			expect(row("前端")).toBeTruthy();
			fireEvent.click(row("前端"));
			expect(row("样式")).toBeTruthy();

			fireEvent.click(screen.getByRole("button", { name: /返回/ }));
			expect(row("前端")).toBeTruthy();
			expect(queryRow("样式")).toBeNull();
			fireEvent.click(screen.getByRole("button", { name: /返回/ }));
			expect(row("技术")).toBeTruthy();
			expect(screen.queryByRole("button", { name: /返回/ })).toBeNull();
		} finally {
			window.matchMedia = original;
		}
	});
});
