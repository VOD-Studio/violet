import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CodeEditor } from "./code-editor";

const rangeRects = Object.getOwnPropertyDescriptor(Range.prototype, "getClientRects");
const rangeBounds = Object.getOwnPropertyDescriptor(Range.prototype, "getBoundingClientRect");
beforeAll(() => {
	// jsdom has no layout; native editing remains real while browser tests own geometry.
	if (!rangeRects)
		Object.defineProperty(Range.prototype, "getClientRects", {
			configurable: true,
			value: () => [],
		});
	if (!rangeBounds)
		Object.defineProperty(Range.prototype, "getBoundingClientRect", {
			configurable: true,
			value: () => new DOMRect(),
		});
});
afterAll(() => {
	if (!rangeRects) Reflect.deleteProperty(Range.prototype, "getClientRects");
	if (!rangeBounds) Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
});

function EditorExample({ vimEnabled = true, onRun = () => {} }) {
	const [value, setValue] = useState("alpha\nbeta\ngamma");
	return (
		<>
			<button type="button">之前</button>
			<CodeEditor
				value={value}
				language="python"
				vimEnabled={vimEnabled}
				onChange={setValue}
				onRun={onRun}
				label="可编辑的 Python 代码"
			/>
			<button type="button">之后</button>
			<output aria-label="当前代码" aria-live="off">
				{value}
			</output>
		</>
	);
}

function press(target: HTMLElement, key: string, keyCode = key.toUpperCase().charCodeAt(0)) {
	fireEvent.keyDown(target, { key, keyCode, which: keyCode });
}

describe("CodeEditor native editing", () => {
	it("edits the local source with Vim and retains undo across rerenders", async () => {
		render(<EditorExample />);
		const editor = screen.getByRole("textbox", { name: "可编辑的 Python 代码" });
		editor.focus();
		press(editor, "x");
		await waitFor(() =>
			expect(screen.getByLabelText("当前代码").textContent).toBe("lpha\nbeta\ngamma"),
		);
		press(editor, "u");
		await waitFor(() =>
			expect(screen.getByLabelText("当前代码").textContent).toBe("alpha\nbeta\ngamma"),
		);
	});

	it("announces modes and pending keys without losing the cursor on rerender", () => {
		const { rerender } = render(<EditorExample />);
		const editor = screen.getByRole("textbox", { name: "可编辑的 Python 代码" });
		editor.focus();
		press(editor, "g");
		expect(screen.getByLabelText("待完成的 Vim 按键").textContent).toBe("g");
		press(editor, "g");
		press(editor, "i");
		expect(screen.getByRole("status", { name: "代码编辑状态" }).textContent).toBe("插入模式");
		rerender(<EditorExample />);
		expect(screen.getByRole("status", { name: "代码编辑状态" }).textContent).toBe("插入模式");
		press(editor, "Escape", 27);
		press(editor, "v");
		expect(screen.getByRole("status", { name: "代码编辑状态" }).textContent).toBe("可视模式");
		press(editor, "l");
		expect(screen.getByLabelText("光标位置 1:2")).toBeTruthy();
		press(editor, "Escape", 27);
		expect(screen.getByRole("status", { name: "代码编辑状态" }).textContent).toBe("普通模式");
	});

	it("counts the actual forward, backward and linewise Vim selections", () => {
		render(<EditorExample />);
		const editor = screen.getByRole("textbox", { name: "可编辑的 Python 代码" });
		editor.focus();
		press(editor, "v");
		press(editor, "l");
		press(editor, "l");
		expect(screen.getByLabelText("光标位置 1:3").textContent).toBe("选中 3 · 1:3");
		press(editor, "Escape", 27);
		press(editor, "v");
		press(editor, "h");
		expect(screen.getByLabelText("光标位置 1:2").textContent).toBe("选中 2 · 1:2");
		press(editor, "Escape", 27);
		fireEvent.keyDown(editor, { key: "V", keyCode: 86, which: 86, shiftKey: true });
		expect(screen.getByLabelText("光标位置 1:2").textContent).toBe("选中 5 · 1:2");
		press(editor, "Escape", 27);
		expect(screen.getByLabelText("光标位置 1:2").textContent).toBe("1:2");
		expect(screen.getByLabelText("当前代码").textContent).toBe("alpha\nbeta\ngamma");
	});

	it.each([
		{ key: ":", keyCode: 186, label: "Vim 命令", value: "2" },
		{ key: "/", keyCode: 191, label: "Vim 搜索", value: "beta" },
	])("replaces the status row with the native $label prompt", ({
		key,
		keyCode,
		label,
		value,
	}) => {
		render(<EditorExample />);
		const editor = screen.getByRole("textbox", { name: "可编辑的 Python 代码" });
		editor.focus();
		press(editor, "g");
		expect(screen.getByLabelText("待完成的 Vim 按键").textContent).toBe("g");
		press(editor, "Escape", 27);
		expect(screen.getByLabelText("待完成的 Vim 按键").textContent).toBe("");
		press(editor, key, keyCode);
		const prompt = screen.getByRole("textbox", { name: label });
		expect(document.activeElement).toBe(prompt);
		expect(screen.getByLabelText("光标位置 1:1").closest("[hidden]")).not.toBeNull();
		fireEvent.input(prompt, { target: { value } });
		press(prompt, "Enter", 13);
		expect(screen.queryByRole("textbox", { name: label })).toBeNull();
		const position = screen.getByLabelText("光标位置 2:1");
		expect(position.closest("[hidden]")).toBeNull();
		expect(document.activeElement).toBe(editor);
		expect(screen.getByLabelText("当前代码").textContent).toBe("alpha\nbeta\ngamma");
	});

	it("rebinds Vim after toggling without dropping the document or undo history", async () => {
		const { rerender } = render(<EditorExample />);
		const editor = screen.getByRole("textbox", { name: "可编辑的 Python 代码" });
		editor.focus();
		press(editor, "x");
		rerender(<EditorExample vimEnabled={false} />);
		expect(screen.queryByText("NORMAL")).toBeNull();
		expect(screen.getByLabelText("当前代码").textContent).toBe("lpha\nbeta\ngamma");
		rerender(<EditorExample />);
		expect(screen.getByRole("status", { name: "代码编辑状态" }).textContent).toBe("普通模式");
		press(editor, "i");
		expect(screen.getByRole("status", { name: "代码编辑状态" }).textContent).toBe("插入模式");
		press(editor, "Escape", 27);
		press(editor, "u");
		await waitFor(() =>
			expect(screen.getByLabelText("当前代码").textContent).toBe("alpha\nbeta\ngamma"),
		);
	});

	it("uses native Ex line navigation and page-only write feedback", () => {
		render(
			<CodeEditor
				value={Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n")}
				language="python"
				vimEnabled
				onChange={() => {}}
				onRun={() => {}}
				label="代码"
			/>,
		);
		const editor = screen.getByRole("textbox", { name: "代码" });
		editor.focus();
		press(editor, ":", 186);
		let command = screen.getByRole("textbox", { name: "Vim 命令" });
		fireEvent.input(command, { target: { value: "12" } });
		press(command, "Enter", 13);
		expect(screen.getByLabelText("光标位置 12:1")).toBeTruthy();
		press(editor, ":", 186);
		command = screen.getByRole("textbox", { name: "Vim 命令" });
		fireEvent.input(command, { target: { value: "w" } });
		press(command, "Enter", 13);
		expect(screen.getByRole("status", { name: "代码编辑状态" }).textContent).toContain(
			"仅保留在本页",
		);
	});

	it("tracks native search matches through navigation and clears them with nohlsearch", async () => {
		render(<EditorExample />);
		const editor = screen.getByRole("textbox", { name: "可编辑的 Python 代码" });
		editor.focus();
		press(editor, "/", 191);
		const search = screen.getByRole("textbox", { name: "Vim 搜索" });
		fireEvent.input(search, { target: { value: "a" } });
		press(search, "Enter", 13);
		await waitFor(() => expect(screen.getByLabelText("搜索匹配").textContent).toBe("2 / 5"));
		press(editor, "n");
		expect(screen.getByLabelText("搜索匹配").textContent).toBe("3 / 5");
		fireEvent.keyDown(editor, { key: "N", keyCode: 78, which: 78, shiftKey: true });
		expect(screen.getByLabelText("搜索匹配").textContent).toBe("2 / 5");
		press(editor, ":", 186);
		const command = screen.getByRole("textbox", { name: "Vim 命令" });
		fireEvent.input(command, { target: { value: "noh" } });
		press(command, "Enter", 13);
		await waitFor(() => expect(screen.queryByLabelText("搜索匹配")).toBeNull());
		expect(screen.getByLabelText("当前代码").textContent).toBe("alpha\nbeta\ngamma");
	});

	it.each([
		"normal",
		"insert",
		"visual",
		"command",
		"search",
		"plain",
	])("runs before Vim handles accelerator Enter in %s mode", (mode) => {
		const onRun = vi.fn();
		render(<EditorExample vimEnabled={mode !== "plain"} onRun={onRun} />);
		const editor = screen.getByRole("textbox", { name: "可编辑的 Python 代码" });
		editor.focus();
		if (mode === "insert") press(editor, "i");
		if (mode === "visual") press(editor, "v");
		if (mode === "command") press(editor, ":", 186);
		if (mode === "search") press(editor, "/", 191);
		const target =
			mode === "command" || mode === "search"
				? screen.getByRole("textbox", {
						name: mode === "command" ? "Vim 命令" : "Vim 搜索",
					})
				: editor;
		if (mode === "command") fireEvent.input(target, { target: { value: "2" } });
		fireEvent.keyDown(target, { key: "Enter", keyCode: 13, ctrlKey: true });
		fireEvent.keyDown(target, { key: "Enter", keyCode: 13, metaKey: true });
		expect(onRun).toHaveBeenCalledTimes(2);
		if (mode === "command") {
			expect(screen.getByRole("textbox", { name: "Vim 命令" })).toBe(target);
			expect(screen.queryByLabelText("光标位置 2:1")).toBeNull();
		}
		expect(screen.getByLabelText("当前代码").textContent).toBe("alpha\nbeta\ngamma");
	});

	it.each([
		"normal",
		"insert",
		"visual",
		"command",
		"search",
		"plain",
	])("leaves %s mode with native Tab and Shift+Tab", async (mode) => {
		const user = userEvent.setup();
		render(<EditorExample vimEnabled={mode !== "plain"} />);
		const editor = screen.getByRole("textbox", { name: "可编辑的 Python 代码" });
		const enterMode = () => {
			editor.focus();
			if (mode === "insert") press(editor, "i");
			if (mode === "visual") press(editor, "v");
			if (mode === "command") press(editor, ":", 186);
			if (mode === "search") press(editor, "/", 191);
		};
		enterMode();
		await user.tab();
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole("button", { name: "之后" })),
		);
		if (mode === "insert" || mode === "visual") press(editor, "Escape", 27);
		enterMode();
		await user.tab({ shift: true });
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole("button", { name: "之前" })),
		);
		expect(screen.getByLabelText("当前代码").textContent).toBe("alpha\nbeta\ngamma");
	});

	it("respects ancestor cancellation of the run accelerator", () => {
		const onRun = vi.fn();
		render(
			<div onKeyDownCapture={(event) => event.preventDefault()}>
				<EditorExample onRun={onRun} />
			</div>,
		);
		const editor = screen.getByRole("textbox", { name: "可编辑的 Python 代码" });
		fireEvent.keyDown(editor, { key: "Enter", keyCode: 13, ctrlKey: true });
		expect(onRun).not.toHaveBeenCalled();
	});

	it("adopts author source and updated labels without remounting the editor", () => {
		const onChange = vi.fn();
		const { rerender } = render(
			<CodeEditor
				value="first"
				language="python"
				vimEnabled
				onChange={onChange}
				onRun={() => {}}
				label="原代码"
			/>,
		);
		const editor = screen.getByRole("textbox", { name: "原代码" });
		rerender(
			<CodeEditor
				value="replacement"
				language="javascript"
				vimEnabled
				onChange={onChange}
				onRun={() => {}}
				label="新代码"
			/>,
		);
		expect(screen.getByRole("textbox", { name: "新代码" })).toBe(editor);
		expect(editor.textContent).toBe("replacement");
	});

	it("inserts paired brackets through native text input", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(
			<CodeEditor
				value=""
				language="python"
				vimEnabled={false}
				onChange={onChange}
				onRun={() => {}}
				label="代码"
			/>,
		);
		screen.getByRole("textbox", { name: "代码" }).focus();
		await user.keyboard("(");
		await waitFor(() => expect(onChange).toHaveBeenLastCalledWith("()"));
	});

	it("keeps separate editors' modes, changes and write messages isolated", () => {
		const firstChange = vi.fn();
		const secondChange = vi.fn();
		render(
			<>
				<CodeEditor
					value="first"
					language="python"
					vimEnabled
					onChange={firstChange}
					onRun={() => {}}
					label="第一段"
				/>
				<CodeEditor
					value="second"
					language="python"
					vimEnabled
					onChange={secondChange}
					onRun={() => {}}
					label="第二段"
				/>
			</>,
		);
		const first = screen.getByRole("textbox", { name: "第一段" });
		const second = screen.getByRole("textbox", { name: "第二段" });
		first.focus();
		press(first, "i");
		second.focus();
		press(second, "x");
		expect(secondChange).toHaveBeenLastCalledWith("econd");
		expect(firstChange).not.toHaveBeenCalled();
		press(second, ":", 186);
		const command = screen.getByRole("textbox", { name: "Vim 命令" });
		fireEvent.input(command, { target: { value: "w" } });
		press(command, "Enter", 13);
		expect(
			screen.getAllByRole("status", { name: "代码编辑状态" }).map((node) => node.textContent),
		).toEqual(["插入模式", "修改仅保留在本页，未保存到文章"]);
	});
});
