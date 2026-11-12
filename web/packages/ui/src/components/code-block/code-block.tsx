import { cn } from "cn";
import { Check, Copy, LoaderCircle, Play } from "lucide-react";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { CodeBlockOutput } from "./code-block-output";
import { CodeSource } from "./code-source";
import type { CodeBlockProps } from "./types";

const CodeEditor = lazy(() =>
	import("./code-editor").then(({ CodeEditor }) => ({ default: CodeEditor })),
);
const availabilityLabels = {
	ready: "运行",
	loading: "策略加载中…",
	disabled: "运行器已关闭",
	"language-disabled": "此语言已禁用",
	error: "策略读取失败",
};

/** 展示作者源码；传入执行配置后允许仅在当前页面编辑和运行。 */
export function CodeBlock({
	code,
	language = "text",
	filename,
	highlightedLines,
	collapseLines = 12,
	run,
	vimEnabled,
	defaultVimEnabled = true,
	onVimEnabledChange,
	className,
	...props
}: CodeBlockProps) {
	const [original, setOriginal] = useState(code);
	const [draft, setDraft] = useState(code);
	const [expanded, setExpanded] = useState(false);
	const [localVim, setLocalVim] = useState(defaultVimEnabled);
	const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
	const copyVersion = useRef(0);
	const timer = useRef<number | undefined>(undefined);
	const contentId = useId();
	if (original !== code) {
		setOriginal(code);
		setDraft(code);
		setExpanded(false);
		setCopyState("idle");
		copyVersion.current++;
	}
	useEffect(
		() => () => {
			copyVersion.current++;
			clearTimeout(timer.current);
		},
		[],
	);
	const source = run ? draft : code;
	const vim = vimEnabled ?? localVim;
	const lineCount = code.split(/\r\n|\n|\r/).length;
	const foldable = !run && collapseLines > 0 && lineCount > collapseLines;
	const canRun = run?.availability.status === "ready" && !run.running;
	const onRun = () => {
		if (canRun) run?.onRun(draft);
	};
	const copy = async () => {
		const version = ++copyVersion.current;
		clearTimeout(timer.current);
		try {
			await navigator.clipboard.writeText(source);
			if (version !== copyVersion.current) return;
			setCopyState("copied");
			timer.current = window.setTimeout(() => setCopyState("idle"), 1600);
		} catch {
			if (version === copyVersion.current) setCopyState("failed");
		}
	};
	return (
		<figure {...props} className={cn("v-code-block not-prose", className)}>
			<figcaption className="v-code-block__header">
				<span className="v-code-block__language">{language}</span>
				{filename && (
					<span className="v-code-block__filename" title={filename}>
						{filename}
					</span>
				)}
				{run && draft !== code && (
					<>
						<span className="v-code-block__dirty">已修改</span>
						<button
							type="button"
							className="v-code-block__button"
							onClick={() => setDraft(code)}
						>
							还原
						</button>
					</>
				)}
				<span className="v-code-block__actions">
					{run && (
						<button
							type="button"
							className="v-code-block__button v-code-block__vim"
							aria-pressed={vim}
							onClick={() => {
								if (vimEnabled === undefined) setLocalVim(!vim);
								onVimEnabledChange?.(!vim);
							}}
						>
							Vim
						</button>
					)}
					{!run && (
						<button
							type="button"
							className="v-code-block__button"
							aria-label={copyState === "copied" ? "已复制" : "复制代码"}
							onClick={() => void copy()}
						>
							{copyState === "copied" ? (
								<Check aria-hidden="true" />
							) : (
								<Copy aria-hidden="true" />
							)}
							{copyState === "copied" ? "已复制" : "复制"}
						</button>
					)}
					{run && (
						<button
							type="button"
							className="v-code-block__button v-code-block__run"
							disabled={!canRun}
							aria-busy={run.running}
							onClick={onRun}
						>
							{run.running ? (
								<LoaderCircle
									aria-hidden="true"
									className="v-code-block__spinner"
								/>
							) : (
								<Play aria-hidden="true" />
							)}
							{run.running ? "运行中" : availabilityLabels[run.availability.status]}
						</button>
					)}
				</span>
				<span className="v-code-block__announcement" role="status">
					{copyState === "copied"
						? "已复制"
						: copyState === "failed"
							? "复制失败，请重试"
							: ""}
				</span>
			</figcaption>
			{run?.availability.status === "error" && (
				<div className="v-code-block__warning">
					<span role="alert">{run.availability.message}</span>
					<button
						type="button"
						className="v-code-block__button"
						onClick={run.availability.onRetry}
					>
						重试
					</button>
				</div>
			)}
			<div
				id={contentId}
				className="v-code-block__body"
				data-folded={(foldable && !expanded) || undefined}
				style={
					foldable && !expanded
						? { maxHeight: `${collapseLines * 22.75 + 8}px` }
						: undefined
				}
			>
				{run ? (
					<Suspense
						fallback={
							<CodeSource
								code={source}
								language={language}
								highlightedLines={highlightedLines}
							/>
						}
					>
						<CodeEditor
							value={draft}
							language={language}
							vimEnabled={vim}
							onChange={setDraft}
							onRun={onRun}
							label={`可编辑的 ${language} 代码`}
						/>
					</Suspense>
				) : (
					<CodeSource
						code={code}
						language={language}
						highlightedLines={highlightedLines}
					/>
				)}
			</div>
			{foldable && (
				<button
					type="button"
					className="v-code-block__more"
					aria-expanded={expanded}
					aria-controls={contentId}
					onClick={() => setExpanded(!expanded)}
				>
					{expanded ? "收起" : `展开全部 ${lineCount} 行`}
				</button>
			)}
			{run && (
				<CodeBlockOutput output={run.output} running={run.running} result={run.result} />
			)}
		</figure>
	);
}
