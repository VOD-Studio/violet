import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../dialog";
import { Field } from "../../field";
import { commitTags } from "../commit-tags";
import { TagInput, type TagInputProps } from "../tag-input";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const field = () =>
	screen.getByRole<HTMLInputElement>(screen.queryByRole("combobox") ? "combobox" : "textbox");
const chips = () => screen.queryAllByRole("listitem").map((item) => item.textContent);
const live = () => screen.getByRole("status").textContent;
const type = (value: string) => fireEvent.change(field(), { target: { value } });
const press = (key: string, init: KeyboardEventInit = {}) =>
	fireEvent.keyDown(field(), { key, ...init });
const focus = () => act(() => field().focus());

function Fixture(props: TagInputProps) {
	return <TagInput aria-label="标签" {...props} />;
}

function Controlled(props: TagInputProps & { initial?: string[] }) {
	const { initial = [], ...rest } = props;
	const [tags, setTags] = useState(initial);
	return (
		<>
			<Fixture {...rest} value={tags} onValueChange={setTags} />
			<p data-testid="value">{JSON.stringify(tags)}</p>
		</>
	);
}

const controlled = () => JSON.parse(screen.getByTestId("value").textContent ?? "[]") as string[];

describe("TagInput 结构", () => {
	it("标签是 list 里的 listitem，× 是带标签名的按钮且不进 Tab 序", () => {
		render(<Fixture defaultValue={["Go", "Rust"]} />);
		const list = screen.getByRole("list");
		expect(list.getAttribute("aria-label")).toBe("已添加的标签");
		expect(chips()).toEqual(["Go", "Rust"]);
		const remove = screen.getByRole("button", { name: "移除 Go" });
		expect(remove.getAttribute("tabindex")).toBe("-1");
		expect(remove.getAttribute("type")).toBe("button");
	});

	it("输入框在 list 之内、包在 role=none 的节点里，不是 listitem，list 只含芯片", () => {
		render(<Fixture defaultValue={["Go", "Rust"]} />);
		const list = screen.getByRole("list");
		expect(list.contains(field())).toBe(true);
		expect(field().closest("[role=listitem]")).toBeNull();
		expect(field().parentElement?.getAttribute("role")).toBe("none");
		expect(screen.getAllByRole("listitem")).toHaveLength(2);
	});

	it("没有标签时不渲染列表，占位只在没有标签时出现", () => {
		const { unmount } = render(<Fixture />);
		expect(screen.queryByRole("list")).toBeNull();
		expect(field().placeholder).toBe("输入后按回车");
		unmount();
		render(<Fixture defaultValue={["Go"]} />);
		expect(field().placeholder).toBe("");
	});

	it("没有建议时输入框是普通文本框，不带 combobox 语义", () => {
		render(<Fixture />);
		expect(field().getAttribute("role")).toBeNull();
		expect(field().getAttribute("aria-expanded")).toBeNull();
	});

	it("外壳透传 className，输入框接收 ref 与 id", () => {
		const ref = { current: null as HTMLInputElement | null };
		const { container } = render(<Fixture id="tags" className="w-80" ref={ref} />);
		expect(container.firstElementChild?.classList.contains("w-80")).toBe(true);
		expect(field().id).toBe("tags");
		expect(ref.current).toBe(field());
	});
});

describe("TagInput 生成标签", () => {
	it("Enter 生成标签并清空输入，两端空白被去掉，空串被略过", () => {
		render(<Controlled />);
		focus();
		type("  Go  ");
		press("Enter");
		expect(controlled()).toEqual(["Go"]);
		expect(field().value).toBe("");
		press("Enter");
		type("   ");
		press("Enter");
		expect(controlled()).toEqual(["Go"]);
	});

	it("Enter 总是 preventDefault，表单不会因它提交", () => {
		render(<Fixture />);
		focus();
		expect(fireEvent.keyDown(field(), { key: "Enter" })).toBe(false);
	});

	it.each([
		["半角逗号", "a,"],
		["全角逗号", "a，"],
		["顿号", "a、"],
	])("%s生成标签，分隔符之后的内容留在输入框", (_label, typed) => {
		render(<Controlled />);
		focus();
		type(typed);
		expect(controlled()).toEqual(["a"]);
		expect(field().value).toBe("");
		type("b、c");
		expect(controlled()).toEqual(["a", "b"]);
		expect(field().value).toBe("c");
	});

	it("空格不生成标签，标签里可以有空格", () => {
		render(<Controlled />);
		focus();
		type("New York");
		expect(controlled()).toEqual([]);
		press("Enter");
		expect(controlled()).toEqual(["New York"]);
	});

	it("粘贴多段文本一次拆成多个标签，只触发一次 onValueChange", () => {
		const onValueChange = vi.fn();
		render(<Fixture onValueChange={onValueChange} />);
		focus();
		fireEvent.paste(field(), { clipboardData: { getData: () => "a, b、c，d\ne" } });
		expect(chips()).toEqual(["a", "b", "c", "d", "e"]);
		expect(onValueChange).toHaveBeenCalledTimes(1);
		expect(onValueChange).toHaveBeenCalledWith(["a", "b", "c", "d", "e"]);
		expect(field().value).toBe("");
		expect(live()).toBe("已添加 a、b、c、d、e");
	});

	it("粘贴不含分隔符的文本走浏览器默认行为", () => {
		render(<Fixture />);
		focus();
		expect(fireEvent.paste(field(), { clipboardData: { getData: () => "hello world" } })).toBe(
			true,
		);
		expect(chips()).toEqual([]);
	});

	it("粘贴时光标之后的文字留在输入框", () => {
		render(<Fixture />);
		focus();
		type("xz");
		field().setSelectionRange(1, 1);
		fireEvent.paste(field(), { clipboardData: { getData: () => "a,b" } });
		expect(chips()).toEqual(["xa", "b"]);
		expect(field().value).toBe("z");
	});

	it("失焦时输入中的文本自动成为标签", () => {
		render(<Controlled />);
		focus();
		type("half");
		act(() => field().blur());
		expect(controlled()).toEqual(["half"]);
		expect(field().value).toBe("");
	});

	it("normalize 在加入前整理文本，整理成空串的被丢弃", () => {
		render(<Controlled normalize={(raw) => raw.replace(/^#/, "")} />);
		focus();
		type("#react,");
		type("#,");
		type("##x,");
		expect(controlled()).toEqual(["react", "#x"]);
	});

	it("受控值由调用方决定，不被组件自己改写", () => {
		const onValueChange = vi.fn();
		render(<Fixture value={["Go"]} onValueChange={onValueChange} />);
		focus();
		type("Rust");
		press("Enter");
		expect(onValueChange).toHaveBeenCalledWith(["Go", "Rust"]);
		expect(chips()).toEqual(["Go"]);
	});
});

describe("TagInput 去重", () => {
	it("不分大小写，重复项不加，已有的那个闪 600ms，随后恢复", () => {
		vi.useFakeTimers();
		const onReject = vi.fn();
		render(<Fixture defaultValue={["Go", "Rust"]} onReject={onReject} />);
		focus();
		type("go");
		press("Enter");
		expect(chips()).toEqual(["Go", "Rust"]);
		const go = screen.getAllByRole("listitem")[0];
		expect(go.getAttribute("data-dup")).toBeTruthy();
		expect(screen.getAllByRole("listitem")[1].hasAttribute("data-dup")).toBe(false);
		expect(field().value).toBe("");
		expect(onReject).toHaveBeenCalledWith({
			reason: "duplicate",
			tag: "go",
			message: "已经有「Go」了",
		});
		act(() => vi.advanceTimersByTime(599));
		expect(go.hasAttribute("data-dup")).toBe(true);
		act(() => vi.advanceTimersByTime(1));
		expect(go.hasAttribute("data-dup")).toBe(false);
	});

	it("连续重复时闪动标记在 a、b 之间轮换，让动画重播", () => {
		render(<Fixture defaultValue={["Go"]} />);
		focus();
		type("Go");
		press("Enter");
		const first = screen.getByRole("listitem").getAttribute("data-dup");
		type("GO");
		press("Enter");
		const second = screen.getByRole("listitem").getAttribute("data-dup");
		expect([first, second].sort()).toEqual(["a", "b"]);
	});

	it("重复也要播报原因，减弱动态不影响播报", () => {
		render(<Fixture defaultValue={["Go"]} />);
		focus();
		type("GO");
		press("Enter");
		expect(live()).toBe("已经有「Go」了");
	});

	it("同一批里的重复只加一次", () => {
		render(<Fixture />);
		focus();
		fireEvent.paste(field(), { clipboardData: { getData: () => "a,A,b" } });
		expect(chips()).toEqual(["a", "b"]);
	});
});

describe("TagInput 退格与方向键", () => {
	it("输入框为空时退格先选中最后一个，再按一次删除", () => {
		render(<Controlled initial={["Go", "Rust"]} />);
		focus();
		expect(press("Backspace")).toBe(false);
		const items = screen.getAllByRole("listitem");
		expect(items[1].hasAttribute("data-armed")).toBe(true);
		expect(controlled()).toEqual(["Go", "Rust"]);
		press("Backspace");
		expect(controlled()).toEqual(["Go"]);
		expect(screen.getAllByRole("listitem")[0].hasAttribute("data-armed")).toBe(false);
	});

	it("输入框有文字时退格是普通删字", () => {
		render(<Fixture defaultValue={["Go"]} />);
		focus();
		type("ab");
		expect(press("Backspace")).toBe(true);
		expect(screen.getByRole("listitem").hasAttribute("data-armed")).toBe(false);
	});

	it("输入文字、失焦都会取消选中", () => {
		render(<Fixture defaultValue={["Go"]} />);
		focus();
		press("Backspace");
		expect(screen.getByRole("listitem").hasAttribute("data-armed")).toBe(true);
		type("x");
		expect(screen.getByRole("listitem").hasAttribute("data-armed")).toBe(false);
		type("");
		press("Backspace");
		act(() => field().blur());
		expect(screen.getByRole("listitem").hasAttribute("data-armed")).toBe(false);
	});

	it("没有标签时退格什么也不做", () => {
		render(<Fixture />);
		focus();
		expect(press("Backspace")).toBe(true);
	});

	it("光标在最前时 ← 选中最后一个，继续 ← 往前，→ 往后，越过最后一个回到输入", () => {
		render(<Fixture defaultValue={["a", "b", "c"]} />);
		focus();
		const armed = () =>
			screen
				.getAllByRole("listitem")
				.filter((item) => item.hasAttribute("data-armed"))
				.map((item) => item.textContent);
		press("ArrowLeft");
		expect(armed()).toEqual(["c"]);
		press("ArrowLeft");
		expect(armed()).toEqual(["b"]);
		press("ArrowLeft");
		press("ArrowLeft");
		expect(armed()).toEqual(["a"]);
		press("ArrowRight");
		expect(armed()).toEqual(["b"]);
		press("ArrowRight");
		press("ArrowRight");
		expect(armed()).toEqual([]);
	});

	it("光标不在最前时 ← 只是移动光标", () => {
		render(<Fixture defaultValue={["a"]} />);
		focus();
		type("xy");
		field().setSelectionRange(2, 2);
		expect(press("ArrowLeft")).toBe(true);
		expect(screen.getByRole("listitem").hasAttribute("data-armed")).toBe(false);
	});

	it("方向键选中后退格删掉选中的那个，Delete 同样", () => {
		render(<Controlled initial={["a", "b", "c"]} />);
		focus();
		press("ArrowLeft");
		press("ArrowLeft");
		press("Backspace");
		expect(controlled()).toEqual(["a", "c"]);
		press("ArrowLeft");
		press("ArrowLeft");
		press("Delete");
		expect(controlled()).toEqual(["c"]);
	});

	it("输入框有文字、光标在最前时 ← 选中标签，Backspace 删标签而文字保留", () => {
		render(<Controlled initial={["a", "b"]} />);
		focus();
		type("xy");
		field().setSelectionRange(0, 0);
		press("ArrowLeft");
		expect(screen.getAllByRole("listitem")[1].hasAttribute("data-armed")).toBe(true);
		expect(press("Backspace")).toBe(false);
		expect(controlled()).toEqual(["a"]);
		expect(field().value).toBe("xy");
	});

	it("没有选中时 → 与 Delete 都不拦截", () => {
		render(<Fixture defaultValue={["a"]} />);
		focus();
		expect(press("ArrowRight")).toBe(true);
		expect(press("Delete")).toBe(true);
	});

	it("点 × 删除对应标签", () => {
		render(<Controlled initial={["Go", "Rust"]} />);
		fireEvent.click(screen.getByRole("button", { name: "移除 Go" }));
		expect(controlled()).toEqual(["Rust"]);
	});

	it("× 按下时不让输入框失焦", () => {
		render(<Fixture defaultValue={["Go"]} />);
		focus();
		const remove = screen.getByRole("button", { name: "移除 Go" });
		expect(fireEvent.mouseDown(remove)).toBe(false);
		expect(document.activeElement).toBe(field());
	});
});

describe("TagInput 读屏播报", () => {
	it("是 role=status 的礼貌播报区", () => {
		render(<Fixture />);
		const region = screen.getByRole("status");
		expect(region.getAttribute("aria-live")).toBe("polite");
		expect(region.textContent).toBe("");
	});

	it("生成时播报「已添加 X」", () => {
		render(<Fixture />);
		focus();
		type("Go");
		press("Enter");
		expect(live()).toBe("已添加 Go");
	});

	it("删除时播报「已移除 X，还有 N 个」", () => {
		render(<Fixture defaultValue={["Go", "Rust", "Zig"]} />);
		fireEvent.click(screen.getByRole("button", { name: "移除 Go" }));
		expect(live()).toBe("已移除 Go，还有 2 个");
		fireEvent.click(screen.getByRole("button", { name: "移除 Rust" }));
		fireEvent.click(screen.getByRole("button", { name: "移除 Zig" }));
		expect(live()).toBe("已移除 Zig，还有 0 个");
	});

	it("退格两段式的第一段播报选中的标签", () => {
		render(<Fixture defaultValue={["Go"]} />);
		focus();
		press("Backspace");
		expect(live()).toBe("已选中 Go，再按退格删除");
	});

	it("相同的话再次播报时节点会重建，读屏才会重读", () => {
		render(<Fixture defaultValue={["Go"]} />);
		focus();
		type("go");
		press("Enter");
		const first = screen.getByRole("status").firstElementChild;
		type("go");
		press("Enter");
		const second = screen.getByRole("status").firstElementChild;
		expect(second).not.toBe(first);
		expect(second?.textContent).toBe(first?.textContent);
	});
});

describe("TagInput 上限", () => {
	it("到上限后输入框 aria-disabled 且只读，但仍可聚焦，原因进 aria-describedby", () => {
		render(<Fixture max={2} defaultValue={["a", "b"]} />);
		expect(field().getAttribute("aria-disabled")).toBe("true");
		expect(field().readOnly).toBe(true);
		expect(field().disabled).toBe(false);
		expect(field().placeholder).toBe("");
		focus();
		expect(document.activeElement).toBe(field());
		const note = document.getElementById(field().getAttribute("aria-describedby") ?? "");
		expect(note?.textContent).toBe("最多 2 个，删掉一个才能再加");
	});

	it("未到上限时没有 aria-disabled，也没有原因说明", () => {
		render(<Fixture max={3} defaultValue={["a"]} />);
		expect(field().hasAttribute("aria-disabled")).toBe(false);
		expect(field().readOnly).toBe(false);
		expect(field().getAttribute("aria-describedby")).toBeNull();
	});

	it("满了再按 Enter 或输入字符会被拦下并播报原因", () => {
		const onReject = vi.fn();
		render(<Fixture max={1} defaultValue={["a"]} onReject={onReject} />);
		focus();
		expect(press("Enter")).toBe(false);
		expect(live()).toBe("最多 1 个，删掉一个才能再加");
		expect(onReject).toHaveBeenCalledWith({
			reason: "max",
			tag: "",
			message: "最多 1 个，删掉一个才能再加",
		});
		expect(press("x")).toBe(false);
	});

	it("满了还能用退格删除，删掉一个后恢复可输入", () => {
		render(<Controlled max={2} initial={["a", "b"]} />);
		focus();
		press("Backspace");
		press("Backspace");
		expect(controlled()).toEqual(["a"]);
		expect(field().hasAttribute("aria-disabled")).toBe(false);
		expect(field().readOnly).toBe(false);
	});

	it("满了粘贴被拦下", () => {
		render(<Fixture max={1} defaultValue={["a"]} />);
		focus();
		expect(fireEvent.paste(field(), { clipboardData: { getData: () => "b,c" } })).toBe(false);
		expect(chips()).toEqual(["a"]);
	});

	it("一批文本中途到上限：放得下的加入，其余丢弃，播报上限", () => {
		const onReject = vi.fn();
		render(<Fixture max={2} onReject={onReject} />);
		focus();
		fireEvent.paste(field(), { clipboardData: { getData: () => "a,b,c" } });
		expect(chips()).toEqual(["a", "b"]);
		expect(live()).toBe("已添加 a、b。最多 2 个，删掉一个才能再加");
		expect(onReject).toHaveBeenCalledTimes(1);
	});
});

describe("TagInput 校验", () => {
	const validate = (tag: string) => (tag.length > 4 ? "标签最长 4 个字" : null);

	it("不合格时保留输入、标记出错并给出原因", () => {
		const onReject = vi.fn();
		render(<Controlled validate={validate} onReject={onReject} />);
		focus();
		type("toolong");
		press("Enter");
		expect(controlled()).toEqual([]);
		expect(field().value).toBe("toolong");
		expect(field().getAttribute("aria-invalid")).toBe("true");
		const note = document.getElementById(field().getAttribute("aria-describedby") ?? "");
		expect(note?.textContent).toBe("标签最长 4 个字");
		expect(live()).toBe("标签最长 4 个字");
		expect(onReject).toHaveBeenCalledWith({
			reason: "invalid",
			tag: "toolong",
			message: "标签最长 4 个字",
		});
		expect(
			screen
				.getByRole("textbox")
				.closest("[data-slot=tag-input]")
				?.hasAttribute("data-invalid"),
		).toBe(true);
	});

	it("继续输入后错误消失，改对后可以生成", () => {
		render(<Controlled validate={validate} />);
		focus();
		type("toolong");
		press("Enter");
		type("ok");
		expect(field().getAttribute("aria-invalid")).toBeNull();
		expect(field().getAttribute("aria-describedby")).toBeNull();
		press("Enter");
		expect(controlled()).toEqual(["ok"]);
	});

	it("失焦提交不合格的文本时保留输入，不丢字", () => {
		render(<Controlled validate={validate} />);
		focus();
		type("toolong");
		act(() => field().blur());
		expect(field().value).toBe("toolong");
		expect(controlled()).toEqual([]);
	});

	it("validate 收到的是整理之后的文本", () => {
		const check = vi.fn(() => null);
		render(<Fixture validate={check} normalize={(raw) => raw.replace(/^#/, "")} />);
		focus();
		type("#go");
		press("Enter");
		expect(check).toHaveBeenCalledWith("go");
	});

	it("批量粘贴里不合格的段被丢弃并报错，合格的照常加入", () => {
		render(<Controlled validate={validate} />);
		focus();
		fireEvent.paste(field(), { clipboardData: { getData: () => "ok,toolong,fine" } });
		expect(controlled()).toEqual(["ok", "fine"]);
		expect(field().getAttribute("aria-invalid")).toBe("true");
	});

	it("invalid 与 aria-invalid 由外部指定时同样写进输入框与外壳", () => {
		const { rerender } = render(<Fixture invalid />);
		expect(field().getAttribute("aria-invalid")).toBe("true");
		expect(field().closest("[data-slot=tag-input]")?.hasAttribute("data-invalid")).toBe(true);
		rerender(<Fixture aria-invalid="true" />);
		expect(field().closest("[data-slot=tag-input]")?.hasAttribute("data-invalid")).toBe(true);
		rerender(<Fixture invalid={false} aria-invalid="true" />);
		expect(field().getAttribute("aria-invalid")).toBe("false");
	});

	it("valid 给外壳属性，出错时让位", () => {
		const { rerender } = render(<Fixture valid />);
		const shell = () => field().closest("[data-slot=tag-input]");
		expect(shell()?.hasAttribute("data-valid")).toBe(true);
		rerender(<Fixture valid invalid />);
		expect(shell()?.hasAttribute("data-valid")).toBe(false);
	});
});

describe("TagInput 输入法", () => {
	it("组合中的 Enter 是确认候选，不生成标签", () => {
		render(<Controlled />);
		focus();
		type("ni");
		expect(press("Enter", { isComposing: true })).toBe(true);
		expect(controlled()).toEqual([]);
		expect(field().value).toBe("ni");
	});

	it("Safari 在 compositionend 之后才发的 Enter（keyCode 229）同样不生成", () => {
		render(<Controlled />);
		focus();
		type("你好");
		expect(press("Enter", { keyCode: 229 })).toBe(true);
		expect(controlled()).toEqual([]);
	});

	it("组合期间的 Backspace 不会选中标签", () => {
		render(<Fixture defaultValue={["Go"]} />);
		focus();
		fireEvent.compositionStart(field());
		expect(press("Backspace")).toBe(true);
		expect(screen.getByRole("listitem").hasAttribute("data-armed")).toBe(false);
	});

	it("组合期间输入里的全角逗号不拆分，组合结束后才拆", () => {
		render(<Controlled />);
		focus();
		fireEvent.compositionStart(field());
		type("你好，世界");
		expect(controlled()).toEqual([]);
		expect(field().value).toBe("你好，世界");
		fireEvent.compositionEnd(field());
		expect(controlled()).toEqual(["你好"]);
		expect(field().value).toBe("世界");
	});

	it("组合结束后再按 Enter 正常生成", () => {
		render(<Controlled />);
		focus();
		fireEvent.compositionStart(field());
		type("你好");
		fireEvent.compositionEnd(field());
		press("Enter");
		expect(controlled()).toEqual(["你好"]);
	});

	it("input 事件自带 isComposing 时也按组合处理", () => {
		render(<Controlled />);
		focus();
		fireEvent.input(field(), { target: { value: "你，" }, isComposing: true });
		expect(controlled()).toEqual([]);
		expect(field().value).toBe("你，");
	});
});

describe("TagInput 建议", () => {
	const SUGGESTIONS = ["Go", "Rust", "React", "Redis", "TypeScript"];
	const panel = () => screen.queryByRole("listbox");
	const options = () => screen.getAllByRole("option").map((option) => option.textContent);
	const activeOption = () => {
		const id = field().getAttribute("aria-activedescendant");
		return id ? document.getElementById(id) : null;
	};

	it("输入框带 combobox 语义；聚焦但没有输入时不弹", () => {
		render(<Fixture suggestions={SUGGESTIONS} />);
		expect(field().getAttribute("role")).toBe("combobox");
		expect(field().getAttribute("aria-haspopup")).toBe("listbox");
		expect(field().getAttribute("aria-autocomplete")).toBe("list");
		expect(field().getAttribute("aria-expanded")).toBe("false");
		focus();
		expect(panel()).toBeNull();
	});

	it("输入非空才弹出，按包含过滤（不分大小写），没有同名项时追加「创建」", () => {
		render(<Fixture suggestions={SUGGESTIONS} />);
		focus();
		type("re");
		expect(field().getAttribute("aria-expanded")).toBe("true");
		expect(panel()?.id).toBe(field().getAttribute("aria-controls"));
		expect(options()).toEqual(["React", "Redis", "创建「re」"]);
		type("RUST");
		expect(options()).toEqual(["Rust"]);
	});

	it("已选项不再推荐，也不会再出现「创建」", () => {
		render(<Fixture suggestions={SUGGESTIONS} defaultValue={["React"]} />);
		focus();
		type("re");
		expect(options()).toEqual(["Redis", "创建「re」"]);
		type("react");
		expect(panel()).toBeNull();
	});

	it("没有任何匹配且没有候选可建时收起", () => {
		render(<Fixture suggestions={[]} defaultValue={["go"]} />);
		focus();
		type("GO");
		expect(panel()).toBeNull();
	});

	it("匹配片段用 mark 高亮", () => {
		render(<Fixture suggestions={SUGGESTIONS} />);
		focus();
		type("scr");
		expect(screen.getAllByRole("option")[0].querySelector("mark")?.textContent).toBe("Scr");
	});

	it("↑↓ 移动高亮并由 aria-activedescendant 指出，Enter 选中高亮项", () => {
		render(<Controlled suggestions={SUGGESTIONS} />);
		focus();
		type("re");
		expect(activeOption()).toBeNull();
		press("ArrowDown");
		expect(activeOption()?.textContent).toBe("React");
		expect(activeOption()?.getAttribute("aria-selected")).toBe("true");
		press("ArrowDown");
		expect(activeOption()?.textContent).toBe("Redis");
		press("ArrowUp");
		press("Enter");
		expect(controlled()).toEqual(["React"]);
		expect(field().value).toBe("");
		expect(panel()).toBeNull();
		expect(live()).toBe("已添加 React");
	});

	it("方向键不循环，到头停住", () => {
		render(<Fixture suggestions={SUGGESTIONS} />);
		focus();
		type("re");
		press("ArrowUp");
		expect(activeOption()?.textContent).toBe("创建「re」");
		press("ArrowDown");
		expect(activeOption()?.textContent).toBe("创建「re」");
	});

	it("没有键盘高亮时 Enter 提交输入框原文，不选建议", () => {
		render(<Controlled suggestions={SUGGESTIONS} />);
		focus();
		type("re");
		press("Enter");
		expect(controlled()).toEqual(["re"]);
	});

	it("高亮「创建」项后 Enter 提交输入框原文", () => {
		render(<Controlled suggestions={SUGGESTIONS} />);
		focus();
		type("rea");
		press("ArrowDown");
		press("ArrowDown");
		expect(activeOption()?.textContent).toBe("创建「rea」");
		press("Enter");
		expect(controlled()).toEqual(["rea"]);
	});

	it("点选项生成标签，焦点留在输入框", () => {
		render(<Controlled suggestions={SUGGESTIONS} />);
		focus();
		type("go");
		fireEvent.click(screen.getByRole("option", { name: "Go" }));
		expect(controlled()).toEqual(["Go"]);
		expect(document.activeElement).toBe(field());
	});

	it("Home 与 End 留给输入框自己移动光标", () => {
		render(<Fixture suggestions={SUGGESTIONS} />);
		focus();
		type("re");
		expect(press("Home")).toBe(true);
		expect(press("End")).toBe(true);
	});

	it("Esc 收起面板，继续输入或再按 ↓ 重新展开，文本保留", async () => {
		render(<Fixture suggestions={SUGGESTIONS} />);
		focus();
		type("re");
		press("Escape");
		await waitFor(() => expect(panel()).toBeNull());
		expect(field().value).toBe("re");
		press("ArrowDown");
		expect(panel()).not.toBeNull();
		press("Escape");
		await waitFor(() => expect(panel()).toBeNull());
		type("rea");
		expect(panel()).not.toBeNull();
	});

	it("在 Dialog 里第一次 Esc 只收起面板，不关 Dialog", async () => {
		render(
			<Dialog defaultOpen>
				<DialogContent>
					<DialogTitle>编辑</DialogTitle>
					<DialogDescription>标签</DialogDescription>
					<Fixture suggestions={SUGGESTIONS} />
				</DialogContent>
			</Dialog>,
		);
		await settle();
		focus();
		type("re");
		expect(panel()).not.toBeNull();
		fireEvent.keyDown(field(), { key: "Escape" });
		await waitFor(() => expect(panel()).toBeNull());
		expect(screen.queryByRole("dialog")).not.toBeNull();
		fireEvent.keyDown(field(), { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("根上已有的文档级监听对 Esc 先 preventDefault，面板也照样收起", async () => {
		const swallow = (event: KeyboardEvent) => event.key === "Escape" && event.preventDefault();
		document.addEventListener("keydown", swallow, true);
		try {
			render(<Fixture suggestions={SUGGESTIONS} />);
			focus();
			type("re");
			press("Escape");
			await waitFor(() => expect(panel()).toBeNull());
		} finally {
			document.removeEventListener("keydown", swallow, true);
		}
	});

	it("Tab 走开时收起，并把输入中的文本生成标签", async () => {
		render(
			<>
				<Controlled suggestions={SUGGESTIONS} />
				<button type="button">下一个</button>
			</>,
		);
		focus();
		type("re");
		expect(press("Tab")).toBe(true);
		const next = screen.getByRole("button", { name: "下一个" });
		act(() => next.focus());
		await waitFor(() => expect(panel()).toBeNull());
		expect(document.activeElement).toBe(next);
		expect(controlled()).toEqual(["re"]);
	});

	it("满了、禁用、只读时不弹建议", () => {
		const { rerender } = render(
			<Fixture suggestions={SUGGESTIONS} max={1} defaultValue={["Go"]} />,
		);
		focus();
		type("re");
		expect(panel()).toBeNull();
		rerender(<Fixture suggestions={SUGGESTIONS} readOnly />);
		type("re");
		expect(panel()).toBeNull();
	});

	it("normalize 作用于建议的查询串", () => {
		render(<Fixture suggestions={SUGGESTIONS} normalize={(raw) => raw.replace(/^#/, "")} />);
		focus();
		type("#rus");
		expect(options()).toEqual(["Rust", "创建「rus」"]);
	});

	it("通过 container 把面板挂到指定容器", () => {
		const host = document.createElement("div");
		document.body.append(host);
		render(<Fixture suggestions={SUGGESTIONS} container={host} />);
		focus();
		type("go");
		expect(host.contains(panel())).toBe(true);
		host.remove();
	});
});

describe("TagInput 表单与状态", () => {
	it("name 让每个标签渲染一个隐藏输入，没有标签不提交", () => {
		const { container } = render(
			<form>
				<Fixture name="tags" defaultValue={["Go", "Rust"]} />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		expect(new FormData(form).getAll("tags")).toEqual(["Go", "Rust"]);
		fireEvent.click(screen.getByRole("button", { name: "移除 Go" }));
		fireEvent.click(screen.getByRole("button", { name: "移除 Rust" }));
		expect(new FormData(form).has("tags")).toBe(false);
	});

	it("输入框本身不带 name，输入中的文本不会提交", () => {
		const { container } = render(
			<form>
				<Fixture name="tags" />
			</form>,
		);
		type("pending");
		const form = container.querySelector("form") as HTMLFormElement;
		expect(new FormData(form).has("tags")).toBe(false);
		expect(field().hasAttribute("name")).toBe(false);
	});

	it("disabled 时隐藏输入不提交", () => {
		const { container } = render(
			<form>
				<Fixture name="tags" defaultValue={["Go"]} disabled />
			</form>,
		);
		expect(new FormData(container.querySelector("form") as HTMLFormElement).has("tags")).toBe(
			false,
		);
	});

	it("表单 reset 回到 defaultValue，并清掉输入中的文本", async () => {
		const { container } = render(
			<form>
				<Fixture name="tags" defaultValue={["Go"]} />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		focus();
		type("Rust,");
		type("half");
		expect(chips()).toEqual(["Go", "Rust"]);
		act(() => form.reset());
		await waitFor(() => expect(chips()).toEqual(["Go"]));
		expect(field().value).toBe("");
	});

	it("没给 defaultValue 时 reset 回到空", async () => {
		const { container } = render(
			<form>
				<Fixture name="tags" />
			</form>,
		);
		type("a,");
		act(() => (container.querySelector("form") as HTMLFormElement).reset());
		await waitFor(() => expect(chips()).toEqual([]));
	});

	it("受控且没有 defaultValue 时 reset 也清空标签与输入，并通知 onValueChange", async () => {
		const onValueChange = vi.fn();
		function Wrapped() {
			const [tags, setTags] = useState(["a", "b"]);
			return (
				<form>
					<Fixture
						value={tags}
						onValueChange={(next) => {
							onValueChange(next);
							setTags(next);
						}}
					/>
					<p data-testid="value">{JSON.stringify(tags)}</p>
				</form>
			);
		}
		const { container } = render(<Wrapped />);
		focus();
		type("half");
		act(() => (container.querySelector("form") as HTMLFormElement).reset());
		await waitFor(() => expect(controlled()).toEqual([]));
		expect(onValueChange).toHaveBeenLastCalledWith([]);
		expect(field().value).toBe("");
	});

	it("form 指向外置表单时，那个表单的 reset 才生效", async () => {
		const { container } = render(
			<>
				<form id="outer" />
				<Fixture form="outer" name="tags" defaultValue={["Go"]} />
			</>,
		);
		focus();
		type("Rust,");
		expect(chips()).toEqual(["Go", "Rust"]);
		act(() => (container.querySelector("#outer") as HTMLFormElement).reset());
		await waitFor(() => expect(chips()).toEqual(["Go"]));
	});

	it("禁用：输入框原生 disabled，没有 ×，外壳带 data-disabled", () => {
		render(<Fixture defaultValue={["Go"]} disabled />);
		expect(field().disabled).toBe(true);
		expect(screen.queryByRole("button")).toBeNull();
		expect(field().closest("[data-slot=tag-input]")?.hasAttribute("data-disabled")).toBe(true);
	});

	it("只读：标签可读，没有 ×，不能增删，输入框仍可聚焦", () => {
		render(<Controlled initial={["Go"]} readOnly />);
		expect(screen.queryByRole("button")).toBeNull();
		expect(field().readOnly).toBe(true);
		focus();
		expect(document.activeElement).toBe(field());
		expect(press("Backspace")).toBe(true);
		expect(controlled()).toEqual(["Go"]);
	});

	it("loading 在输入区尾部显示指示并设 aria-busy", () => {
		const { container } = render(<Fixture loading />);
		expect(field().getAttribute("aria-busy")).toBe("true");
		expect(container.querySelector("[data-status=loading]")).not.toBeNull();
	});

	it("variant 与 controlSize 映射到输入框外壳的类名", () => {
		const { container } = render(<Fixture variant="outline" controlSize="lg" />);
		const shell = container.firstElementChild as HTMLElement;
		expect(shell.classList.contains("v-input-control--outline")).toBe(true);
		expect(shell.classList.contains("v-input-control--lg")).toBe(true);
	});

	it("required 写进 aria-required", () => {
		render(<Fixture required />);
		expect(field().getAttribute("aria-required")).toBe("true");
	});

	it("onFocus 与 onBlur 落在输入框上", () => {
		const onFocus = vi.fn();
		const onBlur = vi.fn();
		render(<Fixture onFocus={onFocus} onBlur={onBlur} />);
		focus();
		act(() => field().blur());
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});

	it("点外壳空白处聚焦输入框", () => {
		const { container } = render(<Fixture />);
		const shell = container.firstElementChild as HTMLElement;
		expect(fireEvent.mouseDown(shell)).toBe(false);
		expect(document.activeElement).toBe(field());
	});
});

describe("TagInput 与 Field", () => {
	it("标签 for、aria-describedby、aria-invalid 落在真正的 input 上", () => {
		render(
			<Field label="文章标签" hint="回车、逗号或顿号生成标签" error="标签太长">
				<TagInput />
			</Field>,
		);
		const input = screen.getByLabelText("文章标签");
		expect(input.tagName).toBe("INPUT");
		expect(input.getAttribute("aria-invalid")).toBe("true");
		const described = (input.getAttribute("aria-describedby") ?? "")
			.split(" ")
			.map((id) => document.getElementById(id)?.textContent);
		expect(described).toContain("标签太长");
	});

	it("控件自己显式给的 id 与 aria-describedby 优先或取并集，组件自己的原因说明也在其中", () => {
		render(
			<Field label="标签" hint="提示">
				<TagInput id="mine" aria-describedby="extra" max={1} defaultValue={["a"]} />
			</Field>,
		);
		const input = screen.getByLabelText("标签");
		expect(input.id).toBe("mine");
		const ids = (input.getAttribute("aria-describedby") ?? "").split(" ");
		expect(ids).toContain("extra");
		expect(ids.map((id) => document.getElementById(id)?.textContent)).toContain(
			"最多 1 个，删掉一个才能再加",
		);
	});

	it("onReject 的 message 可以直接喂给 Field 的错误位", () => {
		function Wired() {
			const [error, setError] = useState<string>();
			return (
				<Field label="标签" error={error}>
					<TagInput
						defaultValue={["Go"]}
						onReject={(rejection) => setError(rejection.message)}
					/>
				</Field>
			);
		}
		render(<Wired />);
		focus();
		type("go");
		press("Enter");
		expect(
			screen.getByText("已经有「Go」了", {
				selector: ".v-field__message, .v-field__message *",
			}),
		).toBeTruthy();
	});
});

describe("TagInput 服务端渲染", () => {
	it("renderToString 不报错，标签与隐藏输入都在", () => {
		const html = renderToString(
			<TagInput
				aria-label="标签"
				name="tags"
				defaultValue={["Go", "Rust"]}
				suggestions={["Go"]}
			/>,
		);
		expect(html).toContain("Go");
		expect(html).toContain('role="list"');
		expect(html).toContain('type="hidden"');
	});
});

describe("commitTags", () => {
	it("按顺序处理，空段略过，批量只记第一个拒绝", () => {
		const result = commitTags(["a"], ["", " b ", "A", "c", "d"], {
			validate: (tag) => (tag === "c" ? "不要 c" : null),
		});
		expect(result.tags).toEqual(["a", "b", "d"]);
		expect(result.added).toEqual(["b", "d"]);
		expect(result.rejection).toEqual({
			reason: "duplicate",
			tag: "A",
			message: "已经有「a」了",
		});
		expect(result.duplicateOf).toBe("a");
	});

	it("没有新增时不改动列表", () => {
		const result = commitTags(["a"], ["a"], {});
		expect(result.tags).toEqual(["a"]);
		expect(result.added).toEqual([]);
	});

	it("max 为 0 时什么都放不进去", () => {
		const result = commitTags([], ["a"], { max: 0 });
		expect(result.tags).toEqual([]);
		expect(result.rejection?.reason).toBe("max");
	});
});
