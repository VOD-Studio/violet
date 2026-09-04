/**
 * RichTextEditor - 受控富文本编辑器
 *
 * 受控 value/onChange（值为 HTML 或 Markdown 字符串，由 contentType 决定）。
 * 内部用 Tiptap useEditor 管理 ProseMirror 状态，每次 update 调 onChange 回吐最新内容。
 *
 * 能力：
 * - 顶部固定工具栏（历史/标题/格式/列表块/图片）
 * - 选中文本浮出迷你工具栏
 * - 输入 / 唤起斜杠命令菜单
 * - 拖拽/粘贴图片自动上传（purpose=post）并插入
 * - 底部状态栏：字数统计 + 源码切换 + 按能力裁剪的导入/导出按钮
 *
 * 能力裁剪：disabledFeatures（黑名单）经 resolveFeatures 派生为能力集，
 * 扩展注册、工具栏、斜杠菜单与底栏按钮从同一份能力集收窄。
 *
 * 图片插入（工具栏 + 斜杠菜单）通过 onPickImage 回调交由调用方决定如何选图，
 * 默认行为是打开本地上传文件选择器。
 */

import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { Code2, Download, FileUp, Globe } from "lucide-react";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { urlErrorMessage, validateUrl } from "@/shared/lib/url";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/base/button";
import { Checkbox } from "@/shared/ui/base/checkbox";
import { Input } from "@/shared/ui/base/input";
import { Modal } from "@/shared/ui/modal/components/Modal";
import { PromptDialog } from "@/shared/ui/prompt-dialog";
import { EditorBubbleMenu } from "./bubble-menu/EditorBubbleMenu";
import { useEditorUpload } from "./hooks/useEditorUpload";
import { useWordCount } from "./hooks/useWordCount";
import "./styles.css";
import { buildEditorExtensions } from "./extensions";
import { type EditorFeature, resolveFeatures } from "./lib/features";
import {
	type BlockLineEntry,
	buildBlockLineMap,
	findBlockByLine,
	findVisibleBlockPos,
} from "./lib/markdown-position";
import { exportMarkdown, importMarkdownFile } from "./lib/markdown-utils";
import { SlashCommand } from "./slash-menu/SlashCommand";
import { buildSlashItems } from "./slash-menu/slash-items";
import { EditorToolbar } from "./toolbar/EditorToolbar";
import { TableToolbar } from "./toolbar/TableToolbar";
import { MarkdownSourceEditor, type MarkdownSourceHandle } from "./ui/MarkdownSourceEditor";

/** 命令式句柄：供父组件插入图片、取值等 */
export interface RichTextEditorHandle {
	/** 在光标处插入多张图片 */
	insertImages: (images: Array<{ src: string; alt?: string }>) => void;
	/** 取当前 HTML */
	getHTML: () => string;
	/** 取当前 Markdown（降级用，不含颜色等样式） */
	getMarkdown: () => string;
}

export interface RichTextEditorProps {
	/** 受控值（HTML 或 Markdown 字符串） */
	value: string;
	/** 值变更回调 */
	onChange: (content: string) => void;
	/** 内容格式，默认 "html"，笔记等 Markdown 场景传 "markdown" */
	contentType?: "html" | "markdown";
	/** 禁用的能力（黑名单语义）：缺省全量启用；粒度约定见 lib/features.ts */
	disabledFeatures?: readonly EditorFeature[];
	/** 占位符 */
	placeholder?: string;
	/** 导出 .md 时的文件名（不含扩展名） */
	exportName?: string;
	/** 自定义图片插入（工具栏+斜杠菜单点击图片时）；不传则用本地上传 */
	onPickImage?: () => void;
	/** 自定义远程链接导入；不传则不显示「链接」按钮。返回 null 表示取消或失败 */
	onImportUrl?: (url: string, opts: ImportUrlOpts) => Promise<ImportUrlResult | null>;
	/** 远程链接导入成功后，把元信息（标题/摘要/SEO）透传给父级回填表单 */
	onImportUrlMeta?: (meta: ImportUrlMeta) => void;
	/** 远程链接导入成功后，把 warnings（如 AI 还原失败的公式数）透传给父级 toast */
	onImportUrlWarnings?: (warnings: string[]) => void;
	/** 外部 className */
	className?: string;
	/** 最小高度，默认 420 */
	minHeight?: number;
	/** 文档流自增高：内容撑开高度、无内部滚动，由外层容器统一滚动（抽屉场景） */
	autoGrow?: boolean;
}

/** ImportUrlOpts - 远程链接导入的可选行为开关 */
export interface ImportUrlOpts {
	/** 为 true 时调 LLM 反推无源码公式的 LaTeX（需管理员配置 llm_*） */
	aiRestoreFormula: boolean;
}

/** ImportUrlResult - 远程链接导入返回结构（编辑器只关心 html） */
export interface ImportUrlResult {
	/** 提取出的正文 HTML */
	html: string;
	/** 元信息（标题/摘要/SEO），透传给 onImportUrlMeta */
	meta?: ImportUrlMeta;
	/** 非致命提示（如 AI 还原失败的公式数），透传给 onImportUrlWarnings */
	warnings?: string[];
}

/** ImportUrlMeta - 远程文档的元信息，供父级回填表单空字段 */
export interface ImportUrlMeta {
	title?: string;
	excerpt?: string;
	seo_title?: string;
	seo_description?: string;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
	function RichTextEditor(
		{
			value,
			onChange,
			contentType = "html",
			disabledFeatures,
			placeholder,
			exportName = "article",
			onPickImage,
			onImportUrl,
			onImportUrlMeta,
			onImportUrlWarnings,
			className,
			minHeight = 420,
			autoGrow,
		},
		ref,
	) {
		const onChangeRef = useRef(onChange);
		onChangeRef.current = onChange;
		// onPickImageRef 让 handlePickImage 始终引用最新回调，避免循环依赖
		const onPickImageRef = useRef(onPickImage);
		onPickImageRef.current = onPickImage;
		// 编辑器内部滚动容器，传给 BubbleMenu 作为 scrollTarget，
		// 使其在自定义 overflow 容器滚动时也能跟随选区更新位置
		const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);
		const features = useMemo(() => resolveFeatures(disabledFeatures), [disabledFeatures]);

		const handlePickImage = useCallback(() => {
			if (onPickImageRef.current) {
				onPickImageRef.current();
				return;
			}
			// 默认：本地上传
			pickLocalFileRef.current?.();
		}, []);

		const editor = useEditor({
			extensions: [
				...buildEditorExtensions(placeholder, features).filter(
					(e) => e.name !== "slashCommand",
				),
				SlashCommand.configure({
					onPickImage: handlePickImage,
					items: (cb) => buildSlashItems(cb, features),
				}),
			],
			content: value,
			contentType,
			editorProps: {
				attributes: {
					class: cn(
						"prose prose-neutral dark:prose-invert max-w-none",
						"prose-headings:font-semibold prose-pre:bg-[hsl(240_10%_8%)]",
						"focus:outline-none",
					),
					style: `min-height: ${minHeight}px`,
				},
			},
			onUpdate: ({ editor }) => {
				// 重连/重挂载竞态下 schema 可能为 null，isDestroyed 兜底已销毁实例
				if (editor.isDestroyed || !editor.schema) return;
				onChangeRef.current(
					contentType === "markdown" ? editor.getMarkdown() : editor.getHTML(),
				);
			},
		});

		const { pickLocalFile } = useEditorUpload(editor);
		const wordCount = useWordCount(editor);

		// 同步 ref，供稳定回调 handlePickImage 引用最新实例
		const pickLocalFileRef = useRef(pickLocalFile);
		pickLocalFileRef.current = pickLocalFile;

		// 暴露命令式方法给父组件（插入图片、取值）
		useImperativeHandle(
			ref,
			() => ({
				insertImages: (images) => {
					if (!editor) return;
					const chain = editor.chain().focus();
					images.forEach((img, i) => {
						if (i > 0) chain.createParagraphNear();
						chain.setImage({ src: img.src, alt: img.alt });
					});
					chain.run();
				},
				getHTML: () => editor?.getHTML() ?? "",
				getMarkdown: () => editor?.getMarkdown() ?? "",
			}),
			[editor],
		);

		// 外部 value 变更时同步进编辑器（仅在差异时，避免光标跳动）
		// emitUpdate 必须为 true：setContent 后触发 update 事件，useWordCount 才能刷新字数；
		// 回吐的内容与父级 value 收敛后即停止，不会循环。
		// setTimeout 推迟到 React 提交完成后执行，避免 Tiptap 的 ReactNodeView
		// 在生命周期内 mount 时调用 flushSync 触发 React 警告。
		useEffect(() => {
			if (!editor) return;
			if (editor.isDestroyed || !editor.schema) return;
			const current = contentType === "markdown" ? editor.getMarkdown() : editor.getHTML();
			if (value === current) return;
			const timer = setTimeout(() => {
				if (editor.isDestroyed || !editor.schema) return;
				editor.commands.setContent(value || "", {
					contentType,
					emitUpdate: true,
				});
			}, 0);
			return () => clearTimeout(timer);
		}, [value, editor, contentType]);

		const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file && editor) {
				await importMarkdownFile(editor, file);
			}
			e.target.value = "";
		};

		const handleExport = () => {
			if (editor) exportMarkdown(editor, exportName);
		};

		// —— 链接插入弹窗（替代原生 window.prompt）——
		const [linkDialogOpen, setLinkDialogOpen] = useState(false);
		const [linkDefault, setLinkDefault] = useState("https://");
		const openLinkDialog = useCallback(() => {
			if (!editor) return;
			const prev = editor.getAttributes("link").href as string | undefined;
			setLinkDefault(prev ?? "https://");
			setLinkDialogOpen(true);
		}, [editor]);
		const handleLinkConfirm = (url: string) => {
			if (!editor) return;
			if (url.trim() === "") {
				editor.chain().focus().extendMarkRange("link").unsetLink().run();
				return;
			}
			editor.chain().focus().setLink({ href: url.trim() }).run();
		};

		// —— Markdown 源码/编辑器内联切换 ——
		// 切换按「内容块」对齐滚动位置：富文本里一张大图 600px、源码里只有一行
		// `![](url)`,像素/比例对齐会错位。建立「顶层块 ↔ Markdown 起始行号」
		// 映射,切换时对齐到块起点(业界 Joplin/VS Code split-pane 同款)。
		const [sourceMode, setSourceMode] = useState(false);
		const [sourceText, setSourceText] = useState("");
		const sourceEditorRef = useRef<MarkdownSourceHandle | null>(null);
		// 进入源码时构建的块映射,退出源码时复用做行号→块 pos 反查
		const blockMapRef = useRef<ReadonlyArray<BlockLineEntry> | null>(null);
		// 进入源码后要滚到的目标行号（经 prop 传给 MarkdownSourceEditor，
		// 由组件在 view 创建后自行滚动，不依赖父组件 effect 时序）
		const [pendingSourceLine, setPendingSourceLine] = useState<number | null>(null);
		// 退出源码后要滚动到的目标块 pos,等富文本容器 mount 后消费
		const pendingBlockPosRef = useRef<number | null>(null);

		const buildBlockMap = (ed: Editor): ReadonlyArray<BlockLineEntry> => {
			// editor.markdown 由 @tiptap/markdown 注入;缺失时回退空映射(降级到顶部)
			if (!ed.markdown) return [];
			const json = ed.getJSON();
			const topBlocks = json.content ?? [];
			const blocks: Array<readonly [number, string]> = [];
			let pos = 0;
			// PM doc 的顶层 forEach 给出 (node, offset, index)
			ed.state.doc.forEach((node, _offset, index) => {
				const md = ed.markdown?.renderNodeToMarkdown(topBlocks[index], json, index, 0);
				blocks.push([pos, md ?? ""]);
				pos += node.nodeSize;
			});
			return buildBlockLineMap(blocks);
		};

		const findVisibleLine = (
			map: ReadonlyArray<BlockLineEntry>,
			ed: Editor,
			container: HTMLElement,
		): number => {
			if (map.length === 0) return 0;
			const containerTop = container.getBoundingClientRect().top;
			const blockTops: Array<[number, number]> = [];
			for (const entry of map) {
				const dom = ed.view.nodeDOM(entry.pmPos) as HTMLElement | null;
				if (!dom) continue;
				blockTops.push([entry.pmPos, dom.getBoundingClientRect().bottom - containerTop]);
			}
			const visiblePos = findVisibleBlockPos(blockTops);
			if (visiblePos == null) return 0;
			const entry = map.find((e) => e.pmPos === visiblePos);
			return entry?.mdStartLine ?? 0;
		};

		const toggleSourceMode = () => {
			if (!editor) return;
			if (!sourceMode) {
				// 进入源码模式:构建块映射 + 找当前可见块 → 抓 Markdown → 切换
				const map = buildBlockMap(editor);
				blockMapRef.current = map;
				const visibleLine = scrollContainer
					? findVisibleLine(map, editor, scrollContainer)
					: 0;

				setSourceText(editor.getMarkdown());
				setPendingSourceLine(visibleLine);
				setSourceMode(true);
			} else {
				// 退出源码模式:拿当前行号 → 二分找块 pos → 写回 → 切换
				const currentLine = sourceEditorRef.current?.getVisibleLine() ?? 0;
				const targetPos = blockMapRef.current
					? findBlockByLine(blockMapRef.current, currentLine)
					: null;
				const current = editor.getMarkdown();
				if (sourceText !== current) {
					editor.commands.setContent(sourceText, { contentType: "markdown" });
				}
				pendingBlockPosRef.current = targetPos;
				setSourceMode(false);
			}
		};

		// 退出源码后富文本容器 + 新内容渲染完 → 滚到目标块。
		// 不用 scrollIntoView:它会把块顶贴到窗口顶部,目标接近文档末尾时
		// 编辑器被强行上推,下方留一大片空白。手动设 scrollContainer.scrollTop
		// 并 clamp 到 [0, maxScroll],容器只在自己可滚动范围内移动。
		useEffect(() => {
			if (sourceMode || pendingBlockPosRef.current == null) return;
			const pos = pendingBlockPosRef.current;
			if (!editor || !scrollContainer) return;
			requestAnimationFrame(() => {
				const dom = editor.view.nodeDOM(pos) as HTMLElement | null;
				if (dom) {
					const containerTop = scrollContainer.getBoundingClientRect().top;
					const targetTop = dom.getBoundingClientRect().top;
					const delta = targetTop - containerTop;
					const max = scrollContainer.scrollHeight - scrollContainer.clientHeight;
					const clamped = Math.max(0, Math.min(max, scrollContainer.scrollTop + delta));
					scrollContainer.scrollTop = clamped;
				}
				pendingBlockPosRef.current = null;
			});
		}, [sourceMode, scrollContainer, editor]);

		// —— 远程链接导入弹窗 ——
		const [urlDialogOpen, setUrlDialogOpen] = useState(false);
		const [urlError, setUrlError] = useState<string | null>(null);
		const [aiRestoreFormula, setAiRestoreFormula] = useState(false);
		const [urlInput, setUrlInput] = useState("https://");
		const handleImportUrlSubmit = (e: React.FormEvent) => {
			e.preventDefault();
			if (!editor || !onImportUrl) return;
			const trimmed = urlInput.trim();
			// 前端预校验：协议 + hostname 合法性，拦截非法域名结构避免往返后端才报错
			const reason = validateUrl(trimmed);
			if (reason) {
				setUrlError(urlErrorMessage(reason));
				return;
			}
			setUrlError(null);
			setUrlDialogOpen(false);
			void onImportUrl(trimmed, { aiRestoreFormula }).then((result) => {
				if (!result) return;
				editor.commands.setContent(result.html, {
					contentType: "html",
					emitUpdate: true,
				});
				if (result.meta && onImportUrlMeta) {
					onImportUrlMeta(result.meta);
				}
				// warnings（如 AI 还原失败的公式数）透传给父级 toast
				if (result.warnings?.length && onImportUrlWarnings) {
					onImportUrlWarnings(result.warnings);
				}
			});
		};

		return (
			<div
				className={cn(
					"flex flex-col overflow-hidden rounded-lg border border-edge-hairline bg-background",
					!autoGrow && "h-full",
					className,
				)}
			>
				<EditorToolbar
					editor={editor}
					features={features}
					onPickImage={handlePickImage}
					onUploadImage={() => pickLocalFileRef.current?.()}
					onInsertLink={openLinkDialog}
				/>
				{features.table && editor ? <TableToolbar editor={editor} /> : null}
				{sourceMode ? (
					<MarkdownSourceEditor
						ref={sourceEditorRef}
						value={sourceText}
						onChange={setSourceText}
						minHeight={minHeight}
						initialScrollLine={pendingSourceLine}
					/>
				) : (
					<div
						ref={setScrollContainer}
						className={cn("relative px-4 py-3", !autoGrow && "flex-1 overflow-y-auto")}
					>
						{editor ? (
							<EditorBubbleMenu
								editor={editor}
								scrollTarget={scrollContainer ?? undefined}
								onInsertLink={openLinkDialog}
							/>
						) : null}
						<EditorContent editor={editor} />
					</div>
				)}
				<div className="flex items-center justify-between gap-2 border-t border-edge-hairline bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
					<span>{wordCount} 字</span>
					<div className="flex items-center gap-1">
						<Button
							type="button"
							variant={sourceMode ? "secondary" : "ghost"}
							size="xs"
							title="切换 Markdown 源码 / 富文本"
							onClick={toggleSourceMode}
						>
							<Code2 /> 源码
						</Button>
						{features.importFile ? (
							<Button asChild size="xs" variant="ghost" title="导入 .md 文件">
								<label className="cursor-pointer">
									<input
										type="file"
										accept=".md,.markdown,.txt"
										className="hidden"
										onChange={handleImport}
									/>
									<FileUp /> 导入
								</label>
							</Button>
						) : null}
						{onImportUrl ? (
							<Button
								type="button"
								variant="ghost"
								size="xs"
								title="导入远程链接文档"
								onClick={() => {
									setUrlInput("https://");
									setAiRestoreFormula(false);
									setUrlError(null);
									setUrlDialogOpen(true);
								}}
							>
								<Globe /> 链接
							</Button>
						) : null}
						{features.exportFile ? (
							<Button
								type="button"
								variant="ghost"
								size="xs"
								title="导出为 .md"
								onClick={handleExport}
							>
								<Download /> 导出
							</Button>
						) : null}
					</div>
				</div>
				{/* 链接输入弹窗 */}
				<PromptDialog
					open={linkDialogOpen}
					onOpenChange={setLinkDialogOpen}
					title="插入链接"
					label="链接地址"
					defaultValue={linkDefault}
					placeholder="https://"
					onConfirm={handleLinkConfirm}
				/>
				{/* 远程链接导入弹窗（自建 Modal：URL 输入 + AI 还原公式 checkbox） */}
				<Modal
					open={urlDialogOpen}
					onOpenChange={setUrlDialogOpen}
					title="导入远程链接"
					description="粘贴网页地址，解析正文并替换当前内容"
					size="sm"
					footer={
						<>
							<Button
								type="button"
								variant="outline"
								onClick={() => setUrlDialogOpen(false)}
							>
								取消
							</Button>
							<Button type="submit" form="import-url-form">
								导入
							</Button>
						</>
					}
				>
					<form
						id="import-url-form"
						onSubmit={handleImportUrlSubmit}
						className="space-y-4"
					>
						<div className="space-y-1.5">
							<label htmlFor="import-url-input" className="text-sm font-medium">
								网页 URL
							</label>
							<Input
								id="import-url-input"
								value={urlInput}
								onChange={(e) => {
									setUrlInput(e.target.value);
									setUrlError(null);
								}}
								placeholder="https://example.com/article"
								autoFocus
							/>
							{urlError ? (
								<p className="text-sm text-destructive">{urlError}</p>
							) : null}
						</div>
						<label
							htmlFor="ai-restore-formula"
							className="flex cursor-pointer items-start gap-2 text-sm"
						>
							<Checkbox
								id="ai-restore-formula"
								checked={aiRestoreFormula}
								onCheckedChange={(c) => setAiRestoreFormula(c === true)}
								className="mt-0.5"
							/>
							<span>
								<span className="font-medium">用 AI 还原公式</span>
								<span className="block text-xs text-muted-foreground">
									对无法直接提取源码的公式（如 KaTeX 服务端渲染），调用 LLM 反推
									LaTeX。需管理员在站点设置配置 LLM。
								</span>
							</span>
						</label>
					</form>
				</Modal>
			</div>
		);
	},
);
