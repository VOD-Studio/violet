import {
	CodeBlock,
	type CodeBlockAvailability,
	type CodeBlockOutputChunk,
	type CodeBlockRunResult,
	InlineCode,
} from "@violet/ui";
import { useEffect, useRef, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import {
	editorPosition,
	FIBONACCI_OUTPUT,
	initialOutput,
	LONG_SOURCE,
	results,
	SOURCE,
} from "./code-block-data";

function CodeBlockSpecimen({ state }: ExhibitRenderProps) {
	const host = useRef<HTMLDivElement>(null);
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	const [retried, setRetried] = useState(false);
	const [running, setRunning] = useState(state === "running");
	const [output, setOutput] = useState<CodeBlockOutputChunk[]>(() => initialOutput(state));
	const [result, setResult] = useState<CodeBlockRunResult | undefined>(results[state]);
	const readonly =
		state === "reading" ||
		state === "highlighted" ||
		state === "folded" ||
		state === "expanded";
	let availability: CodeBlockAvailability = { status: "ready" };
	if (state === "loading") {
		availability = { status: "loading" };
	}
	if (state === "disabled") {
		availability = { status: "disabled" };
	}
	if (state === "language-disabled") {
		availability = { status: "language-disabled" };
	}
	if (state === "policy-error" && !retried) {
		availability = {
			status: "error",
			message: "无法读取运行策略。请重试。",
			onRetry: () => setRetried(true),
		};
	}

	useEffect(
		() => () => {
			for (const timer of timers.current) {
				clearTimeout(timer);
			}
		},
		[],
	);

	useEffect(() => {
		if (state === "expanded") {
			host.current?.querySelector<HTMLButtonElement>(".v-code-block__more")?.click();
			return;
		}
		if (
			![
				"ready",
				"dirty",
				"insert",
				"visual",
				"pending",
				"command",
				"search",
				"vim-off",
			].includes(state)
		) {
			return;
		}
		let disposed = false;
		let observer: MutationObserver | undefined;
		void import("@codemirror/view").then(({ EditorView }) => {
			if (disposed || !host.current) {
				return;
			}
			const initialize = () => {
				const element = host.current?.querySelector<HTMLElement>(".cm-editor");
				const view = element ? EditorView.findFromDOM(element) : undefined;
				if (!view) {
					return;
				}
				observer?.disconnect();
				if (state === "dirty") {
					view.dispatch({ changes: { from: 0, insert: "# 修改仅保留在本页\n" } });
					return;
				}
				const position = editorPosition(state);
				const line = view.state.doc.line(position.line);
				view.dispatch({
					selection: { anchor: Math.min(line.to, line.from + position.column) },
				});
				view.focus();
				const keys: Record<string, string[]> = {
					insert: ["i"],
					visual: ["v", ...Array<string>(7).fill("l")],
					pending: ["d"],
					command: [":"],
					search: ["/"],
				};
				for (const key of keys[state] ?? []) {
					view.contentDOM.dispatchEvent(
						new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
					);
				}
				if (state === "search" || state === "command") {
					const input = element?.querySelector<HTMLInputElement>(".cm-vim-panel input");
					if (input) {
						input.value = state === "search" ? "fib" : "w";
						input.dispatchEvent(new Event("input", { bubbles: true }));
						input.dispatchEvent(
							new KeyboardEvent("keyup", { key: "b", bubbles: true }),
						);
						if (state === "search") {
							input.dispatchEvent(
								new KeyboardEvent("keydown", {
									key: "Enter",
									keyCode: 13,
									which: 13,
									bubbles: true,
									cancelable: true,
								}),
							);
						}
					}
				}
			};
			observer = new MutationObserver(initialize);
			observer.observe(host.current, { childList: true, subtree: true });
			initialize();
		});
		return () => {
			disposed = true;
			observer?.disconnect();
		};
	}, [state]);

	function demonstrateStream() {
		for (const timer of timers.current) {
			clearTimeout(timer);
		}
		setRunning(true);
		setResult(undefined);
		setOutput([{ kind: "info", text: "$ 运行中…\n" }]);
		timers.current = [
			setTimeout(
				() =>
					setOutput((chunks) => [...chunks, { kind: "stdout", text: FIBONACCI_OUTPUT }]),
				260,
			),
			setTimeout(() => {
				setResult({ status: "success", exitCode: 0, durationMs: 38 });
				setRunning(false);
			}, 420),
		];
	}

	return (
		<div ref={host} className="flex flex-col gap-3 p-1">
			<p className="text-13 text-muted-foreground">
				行内 <InlineCode>fib(10)</InlineCode>
				{!readonly && " · 运行按钮演示输出流，不连接执行服务"}
			</p>
			<CodeBlock
				code={readonly ? LONG_SOURCE : SOURCE}
				language={readonly ? "Go" : "Python"}
				filename={readonly ? "memory/summary.go" : undefined}
				highlightedLines={
					state === "highlighted" || state === "expanded" ? [8, 9, 10, 11] : undefined
				}
				defaultVimEnabled={state !== "vim-off"}
				run={
					readonly
						? undefined
						: { availability, running, output, result, onRun: demonstrateStream }
				}
			/>
		</div>
	);
}

export const codeBlockExhibit: Exhibit = {
	id: "code-block",
	name: "代码块",
	units: ["code-block"],
	zone: "content",
	category: "content",
	footprint: { width: 768, height: 680 },
	states: [
		{ id: "reading", label: "阅读" },
		{ id: "highlighted", label: "作者标行" },
		{ id: "folded", label: "折叠" },
		{ id: "expanded", label: "展开" },
		{ id: "ready", label: "可运行 / NORMAL" },
		{ id: "dirty", label: "已修改" },
		{ id: "insert", label: "INSERT" },
		{ id: "visual", label: "VISUAL" },
		{ id: "pending", label: "未完成按键" },
		{ id: "command", label: "命令行" },
		{ id: "search", label: "搜索" },
		{ id: "vim-off", label: "关闭 Vim" },
		{ id: "loading", label: "策略加载中" },
		{ id: "disabled", label: "运行器已关闭" },
		{ id: "language-disabled", label: "语言禁用" },
		{ id: "policy-error", label: "策略读取失败" },
		{ id: "running", label: "运行中" },
		{ id: "success", label: "完成" },
		{ id: "nonzero-exit", label: "非零退出" },
		{ id: "timeout", label: "执行超时" },
		{ id: "oom", label: "内存超限" },
	],
	Render: ({ state }) => <CodeBlockSpecimen key={state} state={state} />,
};
