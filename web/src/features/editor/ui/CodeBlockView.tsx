/** Tiptap 代码块保留源码编辑、高亮、显示元数据与执行结果。 */

import { getExecResult, submitExec } from "@entities/code-runner/api/exec";
import {
	type CodeRunnerAvailability,
	useCodeRunnerAvailability,
} from "@entities/code-runner/hooks/useCodeRunnerAvailability";
import { isTerminalStatus } from "@entities/code-runner/model/types";
import { toCodeBlockRunResult } from "@entities/code-runner/ui/code-run-result";
import { useDebouncedValue } from "@shared/hooks/use-debounced-value";
import { findArticleEmbed, LazyArticleEmbed } from "@shared/ui/article-embeds";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Fragment } from "@tiptap/pm/model";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import {
	Button,
	CodeBlockOutput,
	type CodeBlockOutputChunk,
	type CodeBlockRunResult,
	Input,
	iconProps,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@violet/ui";
import type { createLowlight } from "lowlight";
import { Pencil, Play } from "lucide-react";
import { useId, useState } from "react";

import {
	parseFenceInfo,
	readRawFenceInfo,
	serializeFenceInfo,
} from "@/shared/lib/markdown/fence-info";
import { ensureLanguageRegistered } from "../extensions";
import { renderCodeFence } from "../extensions/code-fence";
import { EmbedInsertDialog } from "./EmbedInsertDialog";

/**
 * 代码块语言下拉选项。
 *
 * 覆盖 lowlight common 预设的全部语言 + 常用扩展项（dockerfile/nginx/vue/powershell 等）。
 * common 预设外的语言编辑时不实时高亮，由 extensions 的 ensureLanguageRegistered 按需注册；
 * 保存后前台由 CodeBlock 的 Shiki Worker 按需高亮，未知语言保留纯文本。
 */
const LANGUAGES = [
	{ value: "text", label: "自动/纯文本" },
	{ value: "plaintext", label: "纯文本" },
	// —— Web / 前端 ——
	{ value: "html", label: "HTML" },
	{ value: "css", label: "CSS" },
	{ value: "scss", label: "SCSS" },
	{ value: "less", label: "Less" },
	{ value: "javascript", label: "JavaScript" },
	{ value: "typescript", label: "TypeScript" },
	{ value: "jsx", label: "JSX" },
	{ value: "tsx", label: "TSX" },
	{ value: "vue", label: "Vue" },
	{ value: "json", label: "JSON" },
	{ value: "yaml", label: "YAML" },
	{ value: "markdown", label: "Markdown" },
	// —— 系统 / 脚本 / 配置 ——
	{ value: "bash", label: "Bash / Shell" },
	{ value: "shell", label: "Shell Session" },
	{ value: "powershell", label: "PowerShell" },
	{ value: "dockerfile", label: "Dockerfile" },
	{ value: "nginx", label: "Nginx" },
	{ value: "makefile", label: "Makefile" },
	{ value: "ini", label: "INI / TOML" },
	{ value: "diff", label: "Diff" },
	// —— 后端 / 编译型 ——
	{ value: "go", label: "Go" },
	{ value: "rust", label: "Rust" },
	{ value: "python", label: "Python" },
	{ value: "java", label: "Java" },
	{ value: "kotlin", label: "Kotlin" },
	{ value: "swift", label: "Swift" },
	{ value: "ruby", label: "Ruby" },
	{ value: "php", label: "PHP" },
	{ value: "c", label: "C" },
	{ value: "cpp", label: "C++" },
	{ value: "csharp", label: "C#" },
	{ value: "objectivec", label: "Objective-C" },
	{ value: "lua", label: "Lua" },
	{ value: "r", label: "R" },
	{ value: "perl", label: "Perl" },
	{ value: "graphql", label: "GraphQL" },
	{ value: "sql", label: "SQL" },
	// —— 标记 / 其它 ——
	{ value: "xml", label: "XML" },
	{ value: "arduino", label: "Arduino" },
	{ value: "wasm", label: "WebAssembly" },
];

/** 停止输入多久后刷新嵌入预览（ms）：逐字刷新时半截 JSON 会让预览在降级提示与卡片之间来回闪。 */
const PREVIEW_DELAY = 400;

/**
 * 从 class 字符串中提取语言 id。
 *
 * 兼容远程文档/HTML 粘贴常见的多种前缀：
 * - `language-go`（highlight.js / markdown 标准）
 * - `lang-go`（部分站点简写）
 * - `hljs-go`（highlight.js 旧版输出）
 * - `brush: go` / `brush-go`（SyntaxHighlighter）
 *
 * @returns 语言 id，未匹配返回 null
 */
function extractLangFromClass(className: string | null | undefined): string | null {
	if (!className) return null;
	// brush: go（带冒号空格）
	const brushColon = className.match(/\bbrush[\s:]+([\w-]+)/i);
	if (brushColon) return brushColon[1].toLowerCase();
	// language- / lang- / hljs- / brush- 前缀
	const prefixed = className.match(/\b(?:language|lang|hljs|brush)-([\w-]+)/i);
	if (prefixed) return prefixed[1].toLowerCase();
	return null;
}

/**
 * 归一化语言 id。
 *
 * 空值、plaintext、text 统一返回 null，让 lowlight 走 highlightAuto 自动识别；
 * 其余原样返回（sh/bash、docker/dockerfile 等别名交由 lowlight 自身 alias 解析）。
 */
function normalizeLang(id: string | null): string | null {
	if (!id) return null;
	const trimmed = id.trim().toLowerCase();
	if (!trimmed || trimmed === "plaintext" || trimmed === "text") return null;
	return trimmed;
}

/**
 * 从 DOM 元素（<pre> 或其 <code> 子元素）解析代码块语言。
 *
 * 依次检查 class（多前缀）与 lang / data-language / data-lang 属性。
 * readability（go-readability）抽取掘金等站点时输出 `<code lang="go">`，
 * 故 lang 属性需显式检查，否则会被识别为纯文本。
 */
export function resolveLanguageFromElement(element: Element): string | null {
	const storedLanguage = element.getAttribute("data-lang");
	if (storedLanguage !== null) return storedLanguage || null;
	// 候选元素：<pre> 本身 + 第一个子元素（通常是 <code>）
	const candidates: Element[] = [element];
	if (element.firstElementChild) candidates.push(element.firstElementChild);
	for (const el of candidates) {
		const fromClass = normalizeLang(extractLangFromClass(el.getAttribute("class")));
		if (fromClass) return fromClass;
		const fromAttr = normalizeLang(
			el.getAttribute("lang") ??
				el.getAttribute("data-language") ??
				el.getAttribute("data-lang"),
		);
		if (fromAttr) return fromAttr;
	}
	return null;
}

/**
 * 为代码块装配作者控件与无损 HTML / Markdown 载体。
 *
 * @param lowlight - 编辑器共享的语法高亮实例。
 */
export function createCodeBlockExtension(lowlight: ReturnType<typeof createLowlight>) {
	return CodeBlockLowlight.extend({
		parseHTML() {
			return [
				{
					tag: "pre",
					preserveWhitespace: "full",
					getContent: (element, schema) => {
						const source =
							(element instanceof Element
								? element.getAttribute("data-source")
								: null) ??
							element.textContent ??
							"";
						return source ? Fragment.from(schema.text(source)) : Fragment.empty;
					},
				},
			];
		},
		parseMarkdown(token, helpers) {
			const info = parseFenceInfo(readRawFenceInfo(token.raw ?? "") ?? token.lang ?? "");
			if (info.language === "mermaid" && !info.runnable) {
				return helpers.createNode("diagramBlock", {
					format: "mermaid",
					source: token.text ?? "",
				});
			}
			return helpers.createNode(
				"codeBlock",
				{ ...info, language: info.language || null },
				token.text ? [helpers.createTextNode(token.text)] : [],
			);
		},
		renderMarkdown(node) {
			const source = node.content?.map((child) => child.text ?? "").join("") ?? "";
			const info = serializeFenceInfo({
				language: node.attrs?.language ?? "",
				runnable: node.attrs?.runnable === true,
				filename: node.attrs?.filename ?? null,
				highlightLines: node.attrs?.highlightLines ?? null,
				overrides: node.attrs?.overrides ?? null,
			});
			return renderCodeFence(source, info);
		},
		addNodeView() {
			return ReactNodeViewRenderer(CodeBlockViewRoot);
		},
		addAttributes() {
			return {
				...this.parent?.(),
				language: {
					default: null,
					rendered: false,
					parseHTML: (element: HTMLElement) => resolveLanguageFromElement(element),
				},
				filename: {
					default: null,
					parseHTML: (element: HTMLElement) => element.getAttribute("data-filename"),
					renderHTML: (attributes: { filename?: string | null }) =>
						attributes.filename != null ? { "data-filename": attributes.filename } : {},
				},
				highlightLines: {
					default: null,
					parseHTML: (element: HTMLElement) => element.getAttribute("data-lines"),
					renderHTML: (attributes: { highlightLines?: string | null }) =>
						attributes.highlightLines
							? { "data-lines": attributes.highlightLines }
							: {},
				},
				// 可运行标记：true 时该代码块在阅读页渲染为 CodeRunner
				runnable: {
					default: false,
					parseHTML: (element: HTMLElement) =>
						element.getAttribute("data-runnable") === "true",
					renderHTML: (attributes: { runnable?: boolean }) =>
						attributes.runnable ? { "data-runnable": "true" } : {},
				},
				// 资源覆盖 JSON（作者声明的 timeout/memory/network 等）
				overrides: {
					default: null,
					parseHTML: (element: HTMLElement) =>
						element.getAttribute("data-overrides") || null,
					renderHTML: (attributes: { overrides?: string | null }) =>
						attributes.overrides ? { "data-overrides": attributes.overrides } : {},
				},
			};
		},
		// 所有代码块都保存原始源码，避免往返时反解高亮 HTML 或丢失尾换行。
		renderHTML({
			node,
			HTMLAttributes,
		}: {
			node: {
				attrs: { language?: string | null; runnable?: boolean; overrides?: string | null };
				textContent: string;
			};
			HTMLAttributes: Record<string, unknown>;
		}) {
			const lang = node.attrs.language ?? "";
			const extraAttrs: Record<string, string> = {
				"data-lang": lang,
				"data-source": node.textContent,
			};
			if (node.attrs.runnable) extraAttrs["data-runnable"] = "true";
			if (node.attrs.overrides) extraAttrs["data-overrides"] = node.attrs.overrides;
			return [
				"pre",
				{ ...HTMLAttributes, ...extraAttrs },
				["code", { class: lang ? `language-${lang}` : null }, 0],
			] as const;
		},
	}).configure({ lowlight, defaultLanguage: null });
}

interface CodeBlockViewComponentProps extends NodeViewProps {
	/** 仅可运行代码块读取策略；普通代码与嵌入不依赖查询上下文。 */
	availability?: CodeRunnerAvailability;
}

function CodeBlockViewRoot(props: NodeViewProps) {
	return props.node.attrs.runnable === true ? (
		<RunnableCodeBlockView {...props} />
	) : (
		<CodeBlockViewComponent {...props} />
	);
}

function RunnableCodeBlockView(props: NodeViewProps) {
	const language = (props.node.attrs.language as string) || "text";
	const availability = useCodeRunnerAvailability(language);
	return <CodeBlockViewComponent {...props} availability={availability} />;
}

function CodeBlockViewComponent({
	node,
	updateAttributes,
	extension,
	editor,
	getPos,
	availability,
}: CodeBlockViewComponentProps) {
	const metadataId = useId();
	const language = (node.attrs.language as string) || "text";
	const isRunnable = node.attrs.runnable === true;
	const overridesJson = (node.attrs.overrides as string | null) || undefined;
	// common 预设外的语言首次选中需动态注册语法，期间禁用下拉避免重复触发
	const [registering, setRegistering] = useState(false);
	// 运行状态：idle / running / 结果文本
	const [runState, setRunState] = useState<"idle" | "running">("idle");
	const [output, setOutput] = useState<CodeBlockOutputChunk[]>([]);
	const [result, setResult] = useState<CodeBlockRunResult>();
	void extension;
	const embed = findArticleEmbed(language);
	const previewSource = useDebouncedValue(node.textContent, PREVIEW_DELAY);
	const [editingEmbed, setEditingEmbed] = useState(false);
	// 嵌入的围栏语言不在常用语言里，补一项，下拉才显示得出当前语言
	const options = LANGUAGES.some((entry) => entry.value === language)
		? LANGUAGES
		: [...LANGUAGES, { value: language, label: embed?.inserter?.title ?? language }];

	const handleLanguageChange = async (v: string) => {
		setRegistering(true);
		await ensureLanguageRegistered(v);
		setRegistering(false);
		// updateAttributes 产生 docChanged 事务，LowlightPlugin 据此重算高亮装饰
		updateAttributes({ language: v });
	};

	/** 用选择弹层给出的原文替换整块代码。 */
	const replaceSource = (source: string) => {
		const pos = getPos();
		if (typeof pos !== "number") return;
		const { state, view } = editor;
		view.dispatch(
			state.tr.replaceWith(pos + 1, pos + node.nodeSize - 1, state.schema.text(source)),
		);
	};

	// 编辑器使用轮询路径，正文使用流式订阅；两者由后端再次校验有效策略。
	const handleRun = async () => {
		if (!availability?.allowed || runState === "running") return;
		// 从 node 取纯文本源码（contentEditable 内容）
		const source = node.textContent || "";
		setRunState("running");
		setOutput([]);
		setResult(undefined);
		try {
			const overrides = overridesJson ? JSON.parse(overridesJson) : undefined;
			const taskId = await submitExec({
				language: availability.canonical,
				source,
				overrides,
			});
			// 轮询直到终态
			const maxAttempts = 120; // 最长 ~60s
			for (let i = 0; i < maxAttempts; i++) {
				await new Promise((r) => setTimeout(r, 500));
				const task = await getExecResult(taskId);
				if (isTerminalStatus(task.status)) {
					setOutput([
						{ kind: "stdout", text: task.stdout },
						{ kind: "stderr", text: task.stderr },
					]);
					setResult(toCodeBlockRunResult(task));
					setRunState("idle");
					return;
				}
			}
			setResult(toCodeBlockRunResult(null, "轮询超时，未能获取执行结果"));
			setRunState("idle");
		} catch (err) {
			setResult(toCodeBlockRunResult(null, err instanceof Error ? err.message : String(err)));
			setRunState("idle");
		}
	};

	return (
		<NodeViewWrapper className="v-code-block my-4" aria-busy={runState === "running"}>
			<div className="v-code-block__header" contentEditable={false}>
				<Select
					value={language}
					disabled={registering}
					onValueChange={handleLanguageChange}
				>
					<SelectTrigger variant="plain" controlSize="sm" className="w-36 font-mono">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{options.map((l) => (
								<SelectItem key={l.value} value={l.value}>
									{l.label}
								</SelectItem>
							))}
						</SelectGroup>
					</SelectContent>
				</Select>
				<Popover>
					<PopoverTrigger asChild>
						<Button type="button" size="sm" variant="ghost">
							代码设置
						</Button>
					</PopoverTrigger>
					<PopoverContent aria-label="代码设置" className="w-72">
						<div className="grid gap-3" contentEditable={false}>
							<label
								htmlFor={`${metadataId}-filename`}
								className="grid gap-1 text-sm"
							>
								文件名
								<Input
									id={`${metadataId}-filename`}
									value={node.attrs.filename ?? ""}
									placeholder="main.py"
									onChange={(event) =>
										updateAttributes({ filename: event.target.value || null })
									}
								/>
							</label>
							<label htmlFor={`${metadataId}-lines`} className="grid gap-1 text-sm">
								高亮行
								<Input
									id={`${metadataId}-lines`}
									value={node.attrs.highlightLines ?? ""}
									placeholder="1,3-5"
									pattern="[0-9]+(-[0-9]+)?(,[0-9]+(-[0-9]+)?)*"
									onChange={(event) =>
										updateAttributes({
											highlightLines:
												event.target.value.replace(/\s+/gu, "") || null,
										})
									}
								/>
							</label>
							<p className="text-xs text-muted-foreground">
								行号从 1 开始，用逗号分隔，范围写作 3-5；超出源码的行号不显示。
							</p>
						</div>
					</PopoverContent>
				</Popover>
				{node.attrs.filename && (
					<span className="v-code-block__filename truncate">{node.attrs.filename}</span>
				)}
				{embed?.inserter ? (
					<button
						type="button"
						onClick={() => setEditingEmbed(true)}
						className="ml-auto inline-flex h-6 items-center gap-1 rounded-sm px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					>
						<Pencil {...iconProps(12)} aria-hidden="true" />
						编辑{embed.inserter.title}
					</button>
				) : null}
				{isRunnable && (
					<Button
						type="button"
						size="sm"
						variant={runState === "running" ? "secondary" : "primary"}
						onClick={handleRun}
						disabled={runState === "running" || !availability?.allowed}
					>
						<Play {...iconProps(12)} />
						{runState === "running" ? "运行中…" : (availability?.reason ?? "运行")}
					</Button>
				)}
			</div>
			{isRunnable && availability?.isError && (
				<div
					role="alert"
					className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
				>
					<span>{availability.error.message}</span>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						disabled={availability.isFetching}
						onClick={() => void availability.refetch()}
					>
						重试
					</Button>
				</div>
			)}
			{/*
			 * 可编辑代码区：NodeViewContent 透传 contentEditable。
			 * CodeBlockLowlight 通过 node.attrs.language 应用 ProseMirror decoration（hljs-*），
			 * language-xxx class 仅供 CSS 兜底。结构用 pre（as 仅支持 div，故用 pre 透传）。
			 */}
			<NodeViewContent<"pre">
				as="pre"
				className={`v-code-block__pre m-0! bg-transparent! ${language ? `language-${language}` : ""}`}
			/>
			{embed ? (
				<section
					aria-label="嵌入预览"
					contentEditable={false}
					className="flow-root border-t border-border bg-background px-4"
				>
					<LazyArticleEmbed definition={embed} source={previewSource} />
				</section>
			) : null}
			{embed?.inserter ? (
				<EmbedInsertDialog
					definition={editingEmbed ? embed : null}
					initialSource={node.textContent}
					onSubmit={replaceSource}
					onClose={() => setEditingEmbed(false)}
					returnFocus={() => editor.commands.focus()}
				/>
			) : null}
			{isRunnable && (
				<div contentEditable={false}>
					<CodeBlockOutput
						output={output}
						running={runState === "running"}
						result={result}
					/>
				</div>
			)}
		</NodeViewWrapper>
	);
}
