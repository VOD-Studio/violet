import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeBlock } from "./code-block";
import { CodeBlockOutput } from "./code-block-output";
import type { HighlightToken } from "./highlight-types";
import type { CodeBlockAvailability, CodeBlockRunConfig } from "./types";

const highlight = vi.hoisted(() => vi.fn());
vi.mock("./highlighter", () => ({ highlightCode: highlight }));
vi.mock("./code-editor", () => ({
	CodeEditor: ({
		value,
		onChange,
		label,
		onRun,
	}: {
		value: string;
		onChange: (value: string) => void;
		label: string;
		onRun: () => void;
	}) => (
		<textarea
			aria-label={label}
			value={value}
			onChange={(event) => onChange(event.target.value)}
			onKeyDown={(event) => {
				if (event.ctrlKey && event.key === "Enter") onRun();
			}}
		/>
	),
}));

function runConfig(availability: CodeBlockAvailability = { status: "ready" }): CodeBlockRunConfig {
	return { availability, running: false, output: [], onRun: vi.fn() };
}

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	highlight.mockReset();
});

describe("CodeBlock source and actions", () => {
	it("keeps offscreen source readable and starts enhancement only near the viewport", async () => {
		let intersect: (() => void) | undefined;
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				constructor(callback: IntersectionObserverCallback) {
					intersect = () =>
						callback(
							[{ isIntersecting: true } as IntersectionObserverEntry],
							this as unknown as IntersectionObserver,
						);
				}
				observe() {}
				disconnect() {}
			},
		);
		const { container } = render(<CodeBlock code="offscreen source" />);
		await act(async () => {});
		expect(highlight).not.toHaveBeenCalled();
		expect(container.querySelector("pre code")?.textContent).toBe("offscreen source");
		await act(async () => intersect?.());
		await waitFor(() => expect(highlight).toHaveBeenCalledTimes(1));
	});
	it("clears the copied announcement after 1600ms", async () => {
		vi.useFakeTimers();
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: vi.fn().mockResolvedValue(undefined) },
		});
		render(<CodeBlock code="source" />);
		await act(async () => fireEvent.click(screen.getByRole("button", { name: "复制代码" })));
		expect(screen.getByRole("status").textContent).toBe("已复制");
		expect(screen.getByRole("button", { name: "已复制" }).textContent).toBe("已复制");
		act(() => vi.advanceTimersByTime(1600));
		expect(screen.getByRole("status").textContent).toBe("");
		expect(screen.getByRole("button", { name: "复制代码" }).textContent).toBe("复制");
	});
	it("SSR and raw fallback preserve blank lines, escaping and final newline without number text", () => {
		const code = "<script>\n\n  x & y\n";
		const html = renderToString(<CodeBlock code={code} language="unknown" />);
		expect(html).toContain("&lt;script&gt;");
		const { container } = render(<CodeBlock code={code} language="unknown" />);
		expect(container.querySelector("pre code")?.textContent).toBe(code);
		expect(container.querySelector("figure figcaption")).not.toBeNull();
	});
	it("folding can expand and collapse without dropping any source; zero disables folding", () => {
		const code = Array.from({ length: 15 }, (_, i) => `line ${i}`).join("\n");
		const { container, rerender } = render(<CodeBlock code={code} />);
		const toggle = screen.getByRole("button", { name: "展开全部 15 行" });
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		fireEvent.click(toggle);
		expect(screen.getByRole("button", { name: /收起/ }).getAttribute("aria-expanded")).toBe(
			"true",
		);
		expect(container.querySelector("pre code")?.textContent).toBe(code);
		fireEvent.click(screen.getByRole("button", { name: /收起/ }));
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		rerender(<CodeBlock code={code} collapseLines={0} />);
		expect(screen.queryByRole("button", { name: /全部/ })).toBeNull();
	});
	it("copies the exact source and reports clipboard failure rather than success", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
		render(<CodeBlock code={"a\r\n\n b\n"} />);
		fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
		await waitFor(() => expect(screen.getByRole("status").textContent).toBe("已复制"));
		expect(writeText).toHaveBeenCalledWith("a\r\n\n b\n");
		writeText.mockRejectedValue(new Error("denied"));
		fireEvent.click(screen.getByRole("button", { name: "已复制" }));
		await waitFor(() =>
			expect(screen.getByRole("status").textContent).toBe("复制失败，请重试"),
		);
		expect(screen.queryByRole("button", { name: "已复制" })).toBeNull();
	});
	it("never replaces a changed source with a late highlight response", async () => {
		vi.stubGlobal("IntersectionObserver", undefined);
		const first = Promise.withResolvers<HighlightToken[][]>();
		const second = Promise.withResolvers<HighlightToken[][]>();
		highlight.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		const { container, rerender } = render(<CodeBlock code="old" />);
		await waitFor(() => expect(highlight).toHaveBeenCalledTimes(1));
		rerender(<CodeBlock code="new" />);
		expect(container.querySelector("pre code")?.textContent).toBe("new");
		await waitFor(() => expect(highlight).toHaveBeenCalledTimes(2));
		await act(async () => first.resolve([[{ content: "old", color: "var(--link)" }]]));
		expect(container.querySelector("pre code")?.textContent).toBe("new");
		await act(async () => second.resolve([[{ content: "new", color: "var(--link)" }]]));
		expect(container.querySelector("pre code")?.textContent).toBe("new");
	});
	it("runs the current draft, restores author code, and adopts a new original", async () => {
		const run = runConfig();
		const { rerender } = render(<CodeBlock code="original" language="python" run={run} />);
		const editor = await screen.findByRole("textbox", { name: "可编辑的 python 代码" });
		expect(screen.getByRole("button", { name: "输出" }).getAttribute("aria-expanded")).toBe(
			"false",
		);
		fireEvent.change(editor, { target: { value: "draft\n" } });
		expect(screen.getByText("已修改")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "运行" }));
		expect(run.onRun).toHaveBeenCalledWith("draft\n");
		fireEvent.click(screen.getByRole("button", { name: "还原" }));
		expect((editor as HTMLTextAreaElement).value).toBe("original");
		expect(screen.queryByText("已修改")).toBeNull();
		fireEvent.change(editor, { target: { value: "another draft" } });
		rerender(<CodeBlock code="new author" language="python" run={run} />);
		expect((editor as HTMLTextAreaElement).value).toBe("new author");
	});
	it.each([
		"loading",
		"disabled",
		"language-disabled",
		"error",
	] as const)("blocks button and accelerator when availability is %s", async (status) => {
		const retry = vi.fn();
		const run = runConfig(
			status === "error" ? { status, message: "许可读取失败", onRetry: retry } : { status },
		);
		render(<CodeBlock code="source" run={run} />);
		const editor = await screen.findByRole("textbox");
		fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
		expect(run.onRun).not.toHaveBeenCalled();
		if (status === "error") {
			expect(screen.getByRole("alert").textContent).toBe("许可读取失败");
			fireEvent.click(screen.getByRole("button", { name: "重试" }));
			expect(retry).toHaveBeenCalledOnce();
		}
	});
	it("running disables duplicate runs and Vim works uncontrolled and controlled", async () => {
		const run = { ...runConfig(), running: true };
		const changed = vi.fn();
		const { rerender } = render(
			<CodeBlock code="source" run={run} onVimEnabledChange={changed} />,
		);
		const editor = await screen.findByRole("textbox");
		fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
		expect(run.onRun).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "运行中" }).getAttribute("aria-busy")).toBe(
			"true",
		);
		const vim = screen.getByRole("button", { name: "Vim" });
		fireEvent.click(vim);
		expect(vim.getAttribute("aria-pressed")).toBe("false");
		expect(changed).toHaveBeenLastCalledWith(false);
		rerender(
			<CodeBlock code="source" run={run} vimEnabled={true} onVimEnabledChange={changed} />,
		);
		fireEvent.click(vim);
		expect(vim.getAttribute("aria-pressed")).toBe("true");
		expect(changed).toHaveBeenLastCalledWith(false);
	});
});

describe("CodeBlockOutput", () => {
	it("opens idle output on demand, reopens at run start, and preserves manual collapse across chunks and completion", () => {
		const output = [
			{ kind: "stdout" as const, text: "hel" },
			{ kind: "stdout" as const, text: "lo\n" },
			{ kind: "stderr" as const, text: "error" },
		];
		const { rerender } = render(<CodeBlockOutput output={[]} running={false} />);
		const toggle = screen.getByRole("button", { name: "输出" });
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByRole("log")).toBeNull();
		fireEvent.click(toggle);
		expect(screen.getByRole("log").hidden).toBe(false);
		fireEvent.click(toggle);
		rerender(<CodeBlockOutput output={[]} running />);
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByRole("log").hidden).toBe(false);
		fireEvent.click(toggle);
		rerender(<CodeBlockOutput output={output.slice(0, 1)} running />);
		expect(screen.queryByRole("log")).toBeNull();
		rerender(<CodeBlockOutput output={output} running />);
		expect(screen.queryByRole("log")).toBeNull();
		fireEvent.click(toggle);
		expect(screen.getByRole("log").textContent).toBe("hello\nerror");
		const result = { status: "error" as const, exitCode: 1, durationMs: 41 };
		rerender(<CodeBlockOutput output={output} running={false} result={result} />);
		expect(screen.getByRole("log").textContent).toContain("退出码 1");
		fireEvent.click(toggle);
		rerender(
			<CodeBlockOutput
				output={[...output, { kind: "info", text: "\nfinished" }]}
				running={false}
				result={result}
			/>,
		);
		expect(screen.queryByRole("log")).toBeNull();
		rerender(<CodeBlockOutput output={[]} running />);
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByRole("log").textContent).not.toContain("hello");
	});
	it("does not report a successful zero exit code when the service omitted it", () => {
		render(
			<CodeBlockOutput
				output={[]}
				running={false}
				result={{ status: "success", exitCode: null, durationMs: 1 }}
			/>,
		);
		const log = screen.getByRole("log");
		expect(log.textContent).toContain("退出码未知");
		expect(log.textContent).not.toContain("退出码 0");
	});
});
