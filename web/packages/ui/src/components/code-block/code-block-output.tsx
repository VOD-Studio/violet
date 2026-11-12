import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import type { CodeBlockOutputProps, CodeBlockRunResult } from "./types";

function resultText(result: CodeBlockRunResult) {
	switch (result.status) {
		case "success":
		case "error":
			return `${result.status === "success" ? "✓ 完成" : "✗ 非零退出"} · ${result.exitCode === null ? "退出码未知" : `退出码 ${result.exitCode}`} · ${result.durationMs}ms`;
		case "timeout":
			return "✗ 执行超时";
		case "oom_killed":
			return "✗ 内存超限 (OOM)";
		case "failed":
			return `✗ ${result.message}`;
	}
}

/** 呈现宿主提供的原始输出流与执行结果，不补写分片换行。 */
export function CodeBlockOutput({
	output,
	running,
	result,
	className,
	...props
}: CodeBlockOutputProps) {
	const populated = output.length > 0 || result !== undefined;
	const [open, setOpen] = useState(running || populated);
	const [previousRunning, setPreviousRunning] = useState(running);
	if (previousRunning !== running) {
		setPreviousRunning(running);
		if (running) setOpen(true);
	}
	const id = useId();
	return (
		<div {...props} className={cn("v-code-block__output", className)}>
			<button
				type="button"
				className="v-code-block__output-toggle"
				aria-expanded={open}
				aria-controls={id}
				onClick={() => setOpen(!open)}
			>
				<ChevronDown aria-hidden="true" className="v-code-block__chevron" />
				输出
			</button>
			<div
				id={id}
				hidden={!open}
				className="v-code-block__terminal"
				role="log"
				aria-label="代码运行输出"
				aria-live="polite"
				aria-relevant="additions text"
			>
				{!populated && (
					<span className="v-code-block__chunk v-code-block__chunk--info">
						{running ? "$ 运行中…" : "还没有运行。点「运行」或在代码区按 ⌘↵。"}
					</span>
				)}
				{output.map((chunk, index) => (
					<span
						key={index}
						className={`v-code-block__chunk v-code-block__chunk--${chunk.kind}`}
					>
						{chunk.text}
					</span>
				))}
				{result && (
					<div className="v-code-block__result" data-status={result.status}>
						{resultText(result)}
					</div>
				)}
			</div>
		</div>
	);
}
