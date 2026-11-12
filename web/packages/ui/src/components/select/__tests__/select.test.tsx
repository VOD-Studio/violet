import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../dialog";
import { Field } from "../../field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	type SelectSingleProps,
	SelectTrigger,
	type SelectTriggerProps,
	SelectValue,
} from "../select";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

type SelectBaseLoose = SelectSingleProps;

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const trigger = () => screen.getByRole("combobox");
const panel = () => screen.queryByRole("listbox");
const options = () => screen.getAllByRole("option");
const option = (name: string) => screen.getByRole("option", { name });
const press = (key: string, target: Element = trigger()) => fireEvent.keyDown(target, { key });
const activeOption = () => {
	const id = trigger().getAttribute("aria-activedescendant");
	return id ? document.getElementById(id) : null;
};
const openByClick = () => fireEvent.click(trigger());

const STATUS = [
	{ value: "draft", label: "草稿" },
	{ value: "published", label: "已发布" },
	{ value: "archived", label: "已归档" },
	{ value: "removed", label: "已删除", disabled: true },
	{ value: "review", label: "审核中" },
];

function Items() {
	return (
		<>
			{STATUS.map((item) => (
				<SelectItem key={item.value} value={item.value} disabled={item.disabled}>
					{item.label}
				</SelectItem>
			))}
		</>
	);
}

interface FixtureProps
	extends Omit<
		SelectBaseLoose,
		"children" | "multiple" | "value" | "defaultValue" | "onValueChange"
	> {
	multiple?: boolean;
	value?: string | string[];
	defaultValue?: string | string[];
	onValueChange?: (value: never) => void;
	content?: ReactNode;
	triggerProps?: Partial<Parameters<typeof SelectTrigger>[0]>;
}

function Fixture({ content, triggerProps, ...props }: FixtureProps) {
	return (
		<Select {...(props as Parameters<typeof Select>[0])}>
			<SelectTrigger aria-label="状态" {...triggerProps}>
				<SelectValue placeholder="选择状态" />
			</SelectTrigger>
			<SelectContent>{content === undefined ? <Items /> : content}</SelectContent>
		</Select>
	);
}

describe("Select 触发器", () => {
	it("是带 combobox、haspopup、expanded、controls 的按钮，焦点留在触发器上", () => {
		render(<Fixture />);
		expect(trigger().tagName).toBe("BUTTON");
		expect(trigger().getAttribute("aria-haspopup")).toBe("listbox");
		expect(trigger().getAttribute("aria-expanded")).toBe("false");
		expect(trigger().getAttribute("aria-controls")).toBeTruthy();
		expect(trigger().getAttribute("aria-activedescendant")).toBeNull();

		trigger().focus();
		openByClick();
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
		expect(panel()?.id).toBe(trigger().getAttribute("aria-controls"));
		expect(document.activeElement).toBe(trigger());
	});

	it("展开后 aria-activedescendant 指向高亮项，面板有名称", () => {
		render(<Fixture defaultValue="archived" />);
		openByClick();
		expect(activeOption()?.textContent).toBe("已归档");
		expect(activeOption()?.getAttribute("role")).toBe("option");
		expect(panel()?.getAttribute("aria-label")).toBe("状态");
		press("ArrowDown");
		expect(activeOption()?.textContent).toBe("审核中");
	});

	it("透传 id、aria-describedby 与 aria-invalid，invalid 与 valid 给外壳属性", () => {
		const { rerender } = render(
			<>
				<p id="hint">必选</p>
				<Fixture
					triggerProps={{
						id: "status",
						"aria-describedby": "hint",
						"aria-invalid": true,
					}}
				/>
			</>,
		);
		expect(trigger().id).toBe("status");
		expect(trigger().getAttribute("aria-describedby")).toBe("hint");
		expect(trigger().getAttribute("aria-invalid")).toBe("true");
		expect(trigger().hasAttribute("data-invalid")).toBe(true);

		rerender(
			<Fixture
				triggerProps={{ invalid: true, valid: true, variant: "outline", controlSize: "lg" }}
			/>,
		);
		expect(trigger().getAttribute("aria-invalid")).toBe("true");
		expect(trigger().hasAttribute("data-valid")).toBe(false);
		expect(trigger().classList.contains("v-input-control--outline")).toBe(true);
		expect(trigger().classList.contains("v-input-control--lg")).toBe(true);

		rerender(<Fixture triggerProps={{ valid: true }} />);
		expect(trigger().hasAttribute("data-valid")).toBe(true);
		expect(trigger().getAttribute("aria-invalid")).toBeNull();
	});

	it("disabled 不能展开；readOnly 可聚焦但不能展开，也没有箭头", () => {
		const { rerender } = render(<Fixture disabled />);
		expect(trigger().hasAttribute("disabled")).toBe(true);
		openByClick();
		expect(panel()).toBeNull();

		rerender(<Fixture readOnly />);
		expect(trigger().getAttribute("aria-readonly")).toBe("true");
		expect(trigger().querySelector("svg")).toBeNull();
		trigger().focus();
		expect(document.activeElement).toBe(trigger());
		openByClick();
		press("ArrowDown");
		expect(panel()).toBeNull();
	});

	it("loading 时箭头换成指示器并设 aria-busy，面板没有选项时显示加载中", () => {
		render(
			<Select>
				<SelectTrigger aria-label="系列" loading>
					<SelectValue placeholder="加载选项…" />
				</SelectTrigger>
				<SelectContent loading />
			</Select>,
		);
		expect(trigger().getAttribute("aria-busy")).toBe("true");
		expect(trigger().querySelector("[data-status=loading]")).not.toBeNull();
		openByClick();
		expect(screen.getByRole("status").textContent).toContain("加载中…");
	});
});

describe("Select 服务端渲染", () => {
	// SSR 只透传数组、Fragment、SelectContent、SelectGroup 这些透明容器；选项直接写在 SelectContent 下
	function ServerSingle(props: Partial<Parameters<typeof Select>[0]>) {
		return (
			<Select {...(props as Parameters<typeof Select>[0])}>
				<SelectTrigger aria-label="状态">
					<SelectValue placeholder="选择状态" />
				</SelectTrigger>
				<SelectContent>
					{STATUS.map((item) => (
						<SelectItem key={item.value} value={item.value} disabled={item.disabled}>
							{item.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}

	it("单选 SSR 直出已选标签，选项不进文档", () => {
		const html = renderToString(<ServerSingle defaultValue="published" />);
		expect(html).toContain("已发布");
		expect(html).not.toContain("草稿");
		expect(html).not.toContain('role="option"');
	});

	it("多选 SSR 直出芯片、+N 与已选摘要", () => {
		const html = renderToString(
			<Select multiple defaultValue={["draft", "published", "review"]}>
				<SelectTrigger aria-label="状态">
					<SelectValue placeholder="选择状态" />
				</SelectTrigger>
				<SelectContent>
					{STATUS.map((item) => (
						<SelectItem key={item.value} value={item.value}>
							{item.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>,
		);
		expect(html).toContain("草稿");
		expect(html).toContain("已发布");
		// {`+${hidden}`} 在 SSR HTML 里有注释分隔
		expect(html).toMatch(/\+<!-- -->1/);
		expect(html).toContain("已选 草稿、已发布 等 3 项");
	});

	it("textValue 优先于选项文字，分组内的项同样直出", () => {
		const html = renderToString(
			<Select defaultValue="rss">
				<SelectTrigger aria-label="发布到">
					<SelectValue placeholder="选择发布位置" />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectLabel>站外</SelectLabel>
						<SelectItem value="rss" textValue="转载订阅">
							转载订阅：来自外部站点的更新
						</SelectItem>
					</SelectGroup>
				</SelectContent>
			</Select>,
		);
		expect(html).toContain("转载订阅");
		expect(html).not.toContain("来自外部站点");
	});

	it("水合后无 hydration 警告，文字与 SSR 一致并由实时登记接管", async () => {
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const html = renderToString(<ServerSingle defaultValue="published" />);
		const host = document.createElement("div");
		host.innerHTML = html;
		document.body.append(host);
		let root: ReturnType<typeof hydrateRoot> | undefined;
		try {
			await act(async () => {
				root = hydrateRoot(host, <ServerSingle defaultValue="published" />);
			});
			expect(trigger().textContent).toBe("已发布");
			const mismatches = errors.mock.calls
				.map((call) => call.join(" "))
				.filter((text) => /hydrat|did not match|server rendered/i.test(text));
			expect(mismatches).toEqual([]);
		} finally {
			errors.mockRestore();
			root?.unmount();
			host.remove();
		}
	});
});

describe("SelectItem 属性", () => {
	it("接受外部 ref，卸载时收到 null", () => {
		const ref = vi.fn();
		function Host({ show }: { show: boolean }) {
			return (
				<Fixture
					content={
						show ? (
							<SelectItem value="a" ref={ref}>
								甲
							</SelectItem>
						) : null
					}
				/>
			);
		}
		const { rerender } = render(<Host show />);
		openByClick();
		expect(ref).toHaveBeenCalledWith(option("甲"));
		rerender(<Host show={false} />);
		expect(ref).toHaveBeenLastCalledWith(null);
	});

	it("调用方的 onPointerMove 先执行，defaultPrevented 时不再高亮", () => {
		const calls: string[] = [];
		render(
			<Fixture
				content={
					<>
						<SelectItem value="a" onPointerMove={() => calls.push("a")}>
							甲
						</SelectItem>
						<SelectItem value="b" onPointerMove={(event) => event.preventDefault()}>
							乙
						</SelectItem>
					</>
				}
			/>,
		);
		openByClick();
		fireEvent.pointerMove(option("甲"), { clientX: 1, clientY: 1 });
		expect(calls).toEqual(["a"]);
		expect(activeOption()?.textContent).toBe("甲");
		fireEvent.pointerMove(option("乙"), { clientX: 2, clientY: 2, cancelable: true });
		expect(activeOption()?.textContent).toBe("甲");
	});

	it("禁用项不执行调用方的 onClick，也不选值", () => {
		const onClick = vi.fn();
		const onValueChange = vi.fn();
		render(
			<Fixture
				onValueChange={onValueChange}
				content={
					<SelectItem value="a" disabled onClick={onClick}>
						甲
					</SelectItem>
				}
			/>,
		);
		openByClick();
		fireEvent.click(option("甲"));
		expect(onClick).not.toHaveBeenCalled();
		expect(onValueChange).not.toHaveBeenCalled();
	});
});

describe("Select 在表单项里", () => {
	function Fielded({ error, ...props }: { error?: string } & Partial<SelectTriggerProps>) {
		return (
			<Field label="发布位置" hint="选一个" error={error}>
				<Select defaultValue="draft">
					<SelectTrigger {...props}>
						<SelectValue placeholder="选择" />
					</SelectTrigger>
					<SelectContent>
						<Items />
					</SelectContent>
				</Select>
			</Field>
		);
	}

	it("表单项注入到根的 id 落在触发器上，点标签聚焦触发器", () => {
		render(<Fielded />);
		const label = screen.getByText("发布位置");
		expect(trigger().id).toBeTruthy();
		expect(label.closest("label")?.getAttribute("for")).toBe(trigger().id);
		expect(screen.getByLabelText("发布位置")).toBe(trigger());
		fireEvent.click(label);
		expect(document.activeElement).toBe(trigger());
	});

	it("aria-describedby 指向消息元素，出错时 aria-invalid 为 true 并带出错外观", () => {
		const { rerender } = render(<Fielded />);
		const message = document.getElementById(trigger().getAttribute("aria-describedby") ?? "");
		expect(message?.textContent).toContain("选一个");
		expect(trigger().getAttribute("aria-invalid")).toBeNull();

		rerender(<Fielded error="必须选择" />);
		expect(trigger().getAttribute("aria-invalid")).toBe("true");
		expect(trigger().hasAttribute("data-invalid")).toBe(true);
		const error = document.getElementById(trigger().getAttribute("aria-describedby") ?? "");
		expect(error?.textContent).toContain("必须选择");
	});

	it("触发器自己的 id 优先，aria-describedby 取并集，invalid 与 aria-invalid 不冲突", () => {
		render(
			<>
				<p id="extra">额外说明</p>
				<Fielded id="mine" aria-describedby="extra" invalid={false} error="必须选择" />
			</>,
		);
		expect(trigger().id).toBe("mine");
		const ids = (trigger().getAttribute("aria-describedby") ?? "").split(" ");
		expect(ids).toContain("extra");
		expect(ids).toHaveLength(2);
		// 显式的 invalid={false} 优先于表单项传来的出错状态
		expect(trigger().getAttribute("aria-invalid")).toBe("false");
		expect(trigger().hasAttribute("data-invalid")).toBe(false);
	});

	it("多选时接线落在展开钮上", () => {
		render(
			<Field label="标签" error="至少选一个">
				<Select multiple defaultValue={[]}>
					<SelectTrigger>
						<SelectValue placeholder="添加标签" />
					</SelectTrigger>
					<SelectContent>
						<Items />
					</SelectContent>
				</Select>
			</Field>,
		);
		expect(screen.getByLabelText("标签")).toBe(trigger());
		expect(trigger().getAttribute("aria-invalid")).toBe("true");
		expect(trigger().getAttribute("aria-describedby")).toBeTruthy();
	});

	it("根上直接给的 id 与 aria 属性同样落到触发器", () => {
		render(
			<Select
				id="root-id"
				aria-describedby="d"
				aria-labelledby="l"
				aria-invalid
				defaultValue="draft"
			>
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<Items />
				</SelectContent>
			</Select>,
		);
		expect(trigger().id).toBe("root-id");
		expect(trigger().getAttribute("aria-describedby")).toBe("d");
		expect(trigger().getAttribute("aria-labelledby")).toBe("l");
		expect(trigger().getAttribute("aria-invalid")).toBe("true");
	});
});

describe("Select 打开与导航", () => {
	it.each([["Enter"], [" "], ["ArrowDown"], ["ArrowUp"]])("在触发器上按 %j 展开", (key) => {
		render(<Fixture />);
		trigger().focus();
		press(key);
		expect(panel()).not.toBeNull();
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
	});

	it("点击展开，面板展开时再点触发器收起", async () => {
		render(<Fixture />);
		openByClick();
		expect(panel()).not.toBeNull();
		await settle();
		// 触发器上的按下不算点外部：否则关闭后随即被点击重新打开
		fireEvent.pointerDown(trigger(), { pointerType: "mouse", button: 0 });
		fireEvent.click(trigger());
		await waitFor(() => expect(panel()).toBeNull());
		expect(trigger().getAttribute("aria-expanded")).toBe("false");
	});

	it("展开时高亮已选项，没有已选项则高亮第一个可用项", () => {
		const { unmount } = render(<Fixture defaultValue="published" />);
		openByClick();
		expect(activeOption()?.textContent).toBe("已发布");
		unmount();

		render(<Fixture />);
		openByClick();
		expect(activeOption()?.textContent).toBe("草稿");
	});

	it("↑ ↓ Home End 跳过禁用项、不循环", () => {
		render(<Fixture defaultValue="archived" />);
		openByClick();
		press("ArrowDown");
		expect(activeOption()?.textContent).toBe("审核中");
		press("ArrowDown");
		expect(activeOption()?.textContent).toBe("审核中");
		press("ArrowUp");
		expect(activeOption()?.textContent).toBe("已归档");
		press("Home");
		expect(activeOption()?.textContent).toBe("草稿");
		press("ArrowUp");
		expect(activeOption()?.textContent).toBe("草稿");
		press("End");
		expect(activeOption()?.textContent).toBe("审核中");
	});

	it("字母键按前缀跳转，汉字标签按拼音声母", () => {
		render(
			<Fixture
				content={
					<>
						<SelectItem value="apple">Apple</SelectItem>
						<SelectItem value="cherry">Cherry</SelectItem>
						<SelectItem value="date">草稿</SelectItem>
					</>
				}
			/>,
		);
		openByClick();
		press("c");
		expect(activeOption()?.textContent).toBe("Cherry");
		act(() => {
			vi.useFakeTimers();
			vi.advanceTimersByTime(600);
			vi.useRealTimers();
		});
		press("c");
		expect(activeOption()?.textContent).toBe("草稿");
	});

	it("aria-selected 表示实际选中，选项带 role=option", () => {
		render(<Fixture defaultValue="published" />);
		openByClick();
		expect(options()).toHaveLength(5);
		expect(option("已发布").getAttribute("aria-selected")).toBe("true");
		expect(option("草稿").getAttribute("aria-selected")).toBe("false");
		expect(option("已删除").getAttribute("aria-disabled")).toBe("true");
		press("ArrowDown");
		// 高亮不等于选中
		expect(option("已归档").getAttribute("aria-selected")).toBe("false");
	});

	it("选项上的按下被 preventDefault，不会让触发器失焦", () => {
		render(<Fixture />);
		trigger().focus();
		openByClick();
		expect(fireEvent.mouseDown(option("草稿"))).toBe(false);
		expect(fireEvent.mouseDown(panel() as HTMLElement)).toBe(false);
		expect(document.activeElement).toBe(trigger());
	});
});

describe("Select 选择与关闭", () => {
	it("Enter 选中高亮项，单选选完收起并还焦点", async () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		trigger().focus();
		press("ArrowDown");
		press("ArrowDown");
		press("Enter");
		expect(onValueChange).toHaveBeenCalledWith("published");
		await waitFor(() => expect(panel()).toBeNull());
		expect(document.activeElement).toBe(trigger());
		expect(trigger().textContent).toBe("已发布");
	});

	it("键盘 Space 选中高亮项，键入前缀之后也一样", async () => {
		const onValueChange = vi.fn();
		render(
			<Fixture
				onValueChange={onValueChange}
				content={
					<>
						<SelectItem value="apple">Apple</SelectItem>
						<SelectItem value="cherry">Cherry</SelectItem>
					</>
				}
			/>,
		);
		trigger().focus();
		press("ArrowDown");
		press("c");
		expect(activeOption()?.textContent).toBe("Cherry");
		expect(press(" ")).toBe(false);
		expect(onValueChange).toHaveBeenCalledWith("cherry");
		await waitFor(() => expect(panel()).toBeNull());
		expect(trigger().textContent).toBe("Cherry");
	});

	it("点选项选中；禁用项点不动", async () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		openByClick();
		fireEvent.click(option("已删除"));
		expect(onValueChange).not.toHaveBeenCalled();
		expect(panel()).not.toBeNull();
		fireEvent.click(option("已归档"));
		expect(onValueChange).toHaveBeenCalledWith("archived");
		await waitFor(() => expect(panel()).toBeNull());
	});

	it("再选当前已选项不重复通知", async () => {
		const onValueChange = vi.fn();
		render(<Fixture defaultValue="draft" onValueChange={onValueChange} />);
		openByClick();
		fireEvent.click(option("草稿"));
		expect(onValueChange).not.toHaveBeenCalled();
		await waitFor(() => expect(panel()).toBeNull());
	});

	it("Esc 收起，值不变，焦点还在触发器", async () => {
		render(<Fixture defaultValue="draft" />);
		trigger().focus();
		openByClick();
		press("ArrowDown");
		press("Escape");
		await waitFor(() => expect(panel()).toBeNull());
		expect(trigger().textContent).toBe("草稿");
		expect(document.activeElement).toBe(trigger());
	});

	it("在 Dialog 里 Esc 只收起面板，不关 Dialog", async () => {
		render(
			<Dialog defaultOpen>
				<DialogContent>
					<DialogTitle>编辑</DialogTitle>
					<DialogDescription>选择状态</DialogDescription>
					<Fixture />
				</DialogContent>
			</Dialog>,
		);
		await settle();
		trigger().focus();
		openByClick();
		expect(panel()).not.toBeNull();
		fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
		await waitFor(() => expect(panel()).toBeNull());
		expect(screen.queryByRole("dialog")).not.toBeNull();
		expect(document.activeElement).toBe(trigger());
		// 面板收起后，再按 Esc 才轮到对话框
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
			await waitFor(() => expect(panel()).toBeNull());
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
		expect(press("Tab")).toBe(true);
		const next = screen.getByRole("button", { name: "下一个" });
		act(() => next.focus());
		await waitFor(() => expect(panel()).toBeNull());
		expect(document.activeElement).toBe(next);
	});

	it("焦点移到组件外时收起", async () => {
		render(
			<>
				<Fixture />
				<button type="button">别处</button>
			</>,
		);
		trigger().focus();
		openByClick();
		const other = screen.getByRole("button", { name: "别处" });
		act(() => other.focus());
		await waitFor(() => expect(panel()).toBeNull());
		expect(document.activeElement).toBe(other);
	});

	it("点外部收起", async () => {
		render(<Fixture />);
		openByClick();
		await settle();
		fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 0 });
		fireEvent.pointerUp(document.body, { pointerType: "mouse", button: 0 });
		fireEvent.click(document.body);
		await waitFor(() => expect(panel()).toBeNull());
	});
});

describe("Select 值", () => {
	it("非受控：defaultValue 起步，选择后更新触发器文字", async () => {
		render(<Fixture defaultValue="draft" />);
		expect(trigger().textContent).toBe("草稿");
		openByClick();
		fireEvent.click(option("已发布"));
		await waitFor(() => expect(trigger().textContent).toBe("已发布"));
	});

	it("受控：值由调用方回写，不回写就不变", async () => {
		function Controlled({ follow }: { follow: boolean }) {
			const [value, setValue] = useState("draft");
			return (
				<Fixture value={value} onValueChange={(next: string) => follow && setValue(next)} />
			);
		}
		const { rerender } = render(<Controlled follow={false} />);
		openByClick();
		fireEvent.click(option("已发布"));
		await waitFor(() => expect(panel()).toBeNull());
		expect(trigger().textContent).toBe("草稿");

		rerender(<Controlled follow />);
		openByClick();
		fireEvent.click(option("已发布"));
		await waitFor(() => expect(trigger().textContent).toBe("已发布"));
	});

	it("没有选择时显示占位，值为空串同样", () => {
		const { rerender } = render(<Fixture />);
		expect(trigger().textContent).toBe("选择状态");
		expect(trigger().querySelector("[data-placeholder]")).not.toBeNull();
		rerender(<Fixture value="" onValueChange={() => {}} />);
		expect(trigger().textContent).toBe("选择状态");
	});

	it("选中项的文字在关闭态显示，分组里的项也一样，选项不进入文档", () => {
		render(
			<Fixture
				defaultValue="rss"
				content={
					<>
						<SelectGroup>
							<SelectLabel>站内</SelectLabel>
							<SelectItem value="blog">博客</SelectItem>
						</SelectGroup>
						<SelectGroup>
							<SelectLabel>站外</SelectLabel>
							<SelectItem value="rss">转载订阅</SelectItem>
						</SelectGroup>
					</>
				}
			/>,
		);
		expect(trigger().textContent).toBe("转载订阅");
		expect(screen.queryByText("博客")).toBeNull();
		expect(screen.queryAllByRole("option", { hidden: true })).toHaveLength(0);
		openByClick();
		expect(screen.getByRole("group", { name: "站外" })).not.toBeNull();
		expect(options()).toHaveLength(2);
	});

	it("SelectValue 的 children 自定义已选值的呈现", () => {
		render(
			<Select defaultValue="draft">
				<SelectTrigger aria-label="状态">
					<SelectValue placeholder="选择状态">
						<b>自定义</b>
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<Items />
				</SelectContent>
			</Select>,
		);
		expect(trigger().textContent).toBe("自定义");
	});

	it("textValue 优先于选项文字，并用于触发器显示", () => {
		render(
			<Fixture
				defaultValue="a"
				content={
					<SelectItem value="a" textValue="简称" description="详细说明">
						完整名称
					</SelectItem>
				}
			/>,
		);
		expect(trigger().textContent).toBe("简称");
	});

	it("选项文字不含说明与附加信息", () => {
		render(
			<Fixture
				defaultValue="a"
				content={
					<SelectItem value="a" description="详细说明" meta="3 篇" icon={<i />}>
						博客
					</SelectItem>
				}
			/>,
		);
		expect(trigger().textContent).toBe("博客");
		openByClick();
		expect(screen.getByRole("option", { name: /博客/ })).toBeTruthy();
	});

	it("没有选项显示无选项，empty 可覆盖", () => {
		const { unmount } = render(<Fixture content={null} />);
		openByClick();
		expect(screen.getByText("无选项")).not.toBeNull();
		unmount();

		render(
			<Select>
				<SelectTrigger aria-label="系列">
					<SelectValue placeholder="选择系列" />
				</SelectTrigger>
				<SelectContent empty="还没有系列" />
			</Select>,
		);
		openByClick();
		expect(screen.getByText("还没有系列")).not.toBeNull();
	});
});

describe("Select 表单", () => {
	const hidden = (form: HTMLFormElement) => [
		...form.querySelectorAll<HTMLInputElement>("input[type=hidden]"),
	];

	it("给了 name 才渲染隐藏输入，参与 FormData", () => {
		const { container, rerender } = render(
			<form>
				<Fixture defaultValue="published" />
			</form>,
		);
		expect(container.querySelector("input")).toBeNull();
		rerender(
			<form>
				<Fixture name="status" defaultValue="published" />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		expect(new FormData(form).get("status")).toBe("published");
	});

	it("单选没选时提交空串，disabled 时不提交", () => {
		const { container, rerender } = render(
			<form>
				<Fixture name="status" />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		expect(new FormData(form).get("status")).toBe("");
		rerender(
			<form>
				<Fixture name="status" defaultValue="draft" disabled />
			</form>,
		);
		expect(new FormData(form).has("status")).toBe(false);
	});

	it("多选每个值一个隐藏输入", () => {
		const { container } = render(
			<form>
				<Fixture name="status" multiple defaultValue={["draft", "review"]} />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		expect(hidden(form).map((input) => input.value)).toEqual(["draft", "review"]);
		expect(new FormData(form).getAll("status")).toEqual(["draft", "review"]);
	});

	it("表单 reset 回到 defaultValue", async () => {
		const { container } = render(
			<form>
				<Fixture name="status" defaultValue="draft" />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		openByClick();
		fireEvent.click(option("已发布"));
		await waitFor(() => expect(new FormData(form).get("status")).toBe("published"));
		act(() => form.reset());
		await waitFor(() => expect(new FormData(form).get("status")).toBe("draft"));
		expect(trigger().textContent).toBe("草稿");
	});

	it("受控时 reset 也回到 defaultValue 并通知 onValueChange，没有 defaultValue 回到空", async () => {
		const onValueChange = vi.fn();
		const { container, unmount } = render(
			<form>
				<Fixture
					name="status"
					value="published"
					defaultValue="draft"
					onValueChange={onValueChange}
				/>
			</form>,
		);
		act(() => (container.querySelector("form") as HTMLFormElement).reset());
		await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("draft"));
		unmount();

		const empty = vi.fn();
		const second = render(
			<form>
				<Fixture name="status" value="published" onValueChange={empty} />
			</form>,
		);
		act(() => (second.container.querySelector("form") as HTMLFormElement).reset());
		await waitFor(() => expect(empty).toHaveBeenCalledWith(""));
	});

	it("多选清空后，外置表单（form 属性）与祖先表单的 reset 仍恢复 defaultValue", async () => {
		const { container } = render(
			<>
				<form id="outside" />
				<Fixture name="tags" form="outside" multiple defaultValue={["draft", "review"]} />
			</>,
		);
		const form = container.querySelector("#outside") as HTMLFormElement;
		fireEvent.click(screen.getByRole("button", { name: "清除全部", hidden: true }));
		await waitFor(() => expect(new FormData(form).getAll("tags")).toEqual([]));
		act(() => form.reset());
		await waitFor(() => expect(new FormData(form).getAll("tags")).toEqual(["draft", "review"]));

		const inner = render(
			<form>
				<Fixture name="tags" multiple defaultValue={["draft"]} />
			</form>,
		);
		const ancestor = inner.container.querySelector("form") as HTMLFormElement;
		const clears = screen.getAllByRole("button", { name: "清除全部", hidden: true });
		fireEvent.click(clears[clears.length - 1]);
		act(() => ancestor.reset());
		await waitFor(() => expect(new FormData(ancestor).getAll("tags")).toEqual(["draft"]));
	});

	it("没给 defaultValue 时 reset 回到空，占位重新出现", async () => {
		const { container } = render(
			<form>
				<Fixture name="status" />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		openByClick();
		fireEvent.click(option("已发布"));
		await waitFor(() => expect(trigger().textContent).toBe("已发布"));
		act(() => form.reset());
		await waitFor(() => expect(trigger().textContent).toBe("选择状态"));
	});
});

describe("Select 多选", () => {
	const chip = (name: string) =>
		screen.getByRole("button", { name: `移除 ${name}`, hidden: true });

	it("值是数组，选项带勾选框，选择后面板不收起，aria-multiselectable", () => {
		const onValueChange = vi.fn();
		render(<Fixture multiple defaultValue={["draft"]} onValueChange={onValueChange} />);
		openByClick();
		expect(panel()?.getAttribute("aria-multiselectable")).toBe("true");
		fireEvent.click(option("已发布"));
		expect(onValueChange).toHaveBeenLastCalledWith(["draft", "published"]);
		expect(panel()).not.toBeNull();
		fireEvent.click(option("草稿"));
		expect(onValueChange).toHaveBeenLastCalledWith(["published"]);
		expect(option("已发布").getAttribute("aria-selected")).toBe("true");
		expect(option("草稿").getAttribute("aria-selected")).toBe("false");
	});

	it("键盘：Enter 切换高亮项，不收起", () => {
		render(<Fixture multiple defaultValue={[]} />);
		trigger().focus();
		press("ArrowDown");
		press("Enter");
		press("ArrowDown");
		press("Enter");
		expect(panel()).not.toBeNull();
		expect(option("草稿").getAttribute("aria-selected")).toBe("true");
		expect(option("已发布").getAttribute("aria-selected")).toBe("true");
	});

	it("已选项显示成芯片，超过 2 个折成 +N，maxChips 可调", () => {
		const four = ["draft", "published", "archived", "review"];
		const { unmount } = render(<Fixture multiple defaultValue={["draft", "published"]} />);
		expect(chip("草稿")).not.toBeNull();
		expect(chip("已发布")).not.toBeNull();
		expect(screen.queryByText(/^\+\d+$/)).toBeNull();
		unmount();

		const second = render(<Fixture multiple defaultValue={four} />);
		expect(screen.queryByRole("button", { name: "移除 已归档", hidden: true })).toBeNull();
		expect(screen.getByText("+2")).not.toBeNull();
		second.unmount();

		render(<Fixture multiple defaultValue={four} triggerProps={{ maxChips: 3 }} />);
		expect(chip("已归档")).not.toBeNull();
		expect(screen.getByText("+1")).not.toBeNull();
	});

	it("没有选择时展开钮显示占位，有选择时不显示", () => {
		const { unmount } = render(<Fixture multiple defaultValue={[]} />);
		expect(trigger().textContent).toBe("选择状态");
		unmount();
		render(<Fixture multiple defaultValue={["draft"]} />);
		// 占位只留给读屏，视觉上由芯片呈现
		expect(trigger().querySelector("[data-placeholder]")).toBeNull();
		expect(trigger().querySelector(".v-select-sr")?.textContent).toBe("选择状态");
	});

	it("有值时展开钮仍有可访问名称，并用摘要说明已选内容", () => {
		const { unmount } = render(
			<Select multiple defaultValue={["draft", "published", "review"]}>
				<SelectTrigger>
					<SelectValue placeholder="添加标签" />
				</SelectTrigger>
				<SelectContent>
					<Items />
				</SelectContent>
			</Select>,
		);
		expect(screen.getByRole("combobox", { name: "添加标签" })).toBe(trigger());
		const summary = document.getElementById(trigger().getAttribute("aria-describedby") ?? "");
		expect(summary?.textContent).toBe("已选 草稿、已发布 等 3 项");
		unmount();

		render(<Fixture multiple defaultValue={["draft", "published"]} />);
		expect(trigger().getAttribute("aria-label")).toBe("状态");
		const two = document.getElementById(trigger().getAttribute("aria-describedby") ?? "");
		expect(two?.textContent).toBe("已选 草稿、已发布");
	});

	it("清除全部可 Tab 到达，清除后焦点回到展开钮", () => {
		render(<Fixture multiple defaultValue={["draft"]} />);
		const clear = screen.getByRole("button", { name: "清除全部", hidden: true });
		expect(clear.getAttribute("tabindex")).not.toBe("-1");
		clear.focus();
		fireEvent.click(clear);
		expect(screen.queryByRole("button", { name: "清除全部", hidden: true })).toBeNull();
		expect(document.activeElement).toBe(trigger());
	});

	it("移除钮取消该项并留在组件里，焦点不动；清除全部清空", () => {
		const onValueChange = vi.fn();
		render(
			<Fixture
				multiple
				defaultValue={["draft", "published"]}
				onValueChange={onValueChange}
			/>,
		);
		trigger().focus();
		const remove = chip("草稿");
		expect(remove.getAttribute("tabindex")).toBe("-1");
		expect(fireEvent.mouseDown(remove)).toBe(false);
		fireEvent.click(remove);
		expect(onValueChange).toHaveBeenLastCalledWith(["published"]);
		expect(document.activeElement).toBe(trigger());

		fireEvent.click(screen.getByRole("button", { name: "清除全部", hidden: true }));
		expect(onValueChange).toHaveBeenLastCalledWith([]);
		expect(screen.queryByRole("button", { name: "清除全部", hidden: true })).toBeNull();
	});

	it("disabled 时没有移除钮与清除全部", () => {
		render(<Fixture multiple disabled defaultValue={["draft"]} />);
		expect(screen.queryByRole("button", { name: /移除|清除/, hidden: true })).toBeNull();
	});

	it("点击外壳空白处展开，面板锚定整个外壳", () => {
		render(<Fixture multiple defaultValue={["draft"]} />);
		const shell = trigger().closest("[data-slot=select-trigger]") as HTMLElement;
		fireEvent.click(shell);
		expect(panel()).not.toBeNull();
		expect(trigger().getAttribute("aria-expanded")).toBe("true");
	});

	it("多选触发器的 id 与 aria 属性落在展开钮上", () => {
		render(
			<Fixture
				multiple
				defaultValue={[]}
				triggerProps={{ id: "tags", "aria-describedby": "d" }}
			/>,
		);
		expect(trigger().id).toBe("tags");
		expect(trigger().getAttribute("aria-describedby")).toBe("d");
	});
});

describe("Select 面板挂载", () => {
	it("默认挂到 body，container 可改挂到指定容器", () => {
		const host = document.createElement("div");
		document.body.append(host);
		const { unmount } = render(<Fixture />);
		openByClick();
		expect(panel()?.closest("[data-slot=picker-panel]")?.parentElement?.parentElement).toBe(
			document.body,
		);
		unmount();

		render(
			<Select>
				<SelectTrigger aria-label="状态">
					<SelectValue placeholder="选择状态" />
				</SelectTrigger>
				<SelectContent container={host}>
					<Items />
				</SelectContent>
			</Select>,
		);
		openByClick();
		expect(host.contains(panel())).toBe(true);
		host.remove();
	});
});
