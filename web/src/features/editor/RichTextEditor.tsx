/** HTML/Markdown 受控编辑器；源码输入、富文本与命令式取值共享当前文档。 */

import { EditorContent, useEditor } from "@tiptap/react";
import { Button, PromptDialog } from "@violet/ui";
import { cn } from "cn";
import { Code2, Download, FileUp } from "lucide-react";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";

import { EditorBubbleMenu } from "./bubble-menu/EditorBubbleMenu";
import { useEditorUpload } from "./hooks/useEditorUpload";
import { useMarkdownSource } from "./hooks/useMarkdownSource";
import { useWordCount } from "./hooks/useWordCount";
import "./styles.css";
import { buildEditorExtensions } from "./extensions";
import { resolveFeatures } from "./lib/features";
import { exportMarkdown, importMarkdownFile } from "./lib/markdown-utils";
import { SlashCommand } from "./slash-menu/SlashCommand";
import { buildSlashItems } from "./slash-menu/slash-items";
import { EditorToolbar } from "./toolbar/EditorToolbar";
import { TableToolbar } from "./toolbar/TableToolbar";
import type { ImportUrlOpts, RichTextEditorHandle, RichTextEditorProps } from "./types";
import { ImportUrlButton } from "./ui/ImportUrlButton";
import { MarkdownSourceEditor } from "./ui/MarkdownSourceEditor";

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
		});
		const {
			sourceMode,
			sourceText,
			sourceEditorRef,
			pendingSourceLine,
			changeSource,
			toggleSourceMode,
			getMarkdown,
		} = useMarkdownSource({ editor, value, contentType, onChange, scrollContainer });

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
				getMarkdown,
			}),
			[editor, getMarkdown],
		);

		const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file && editor) {
				await importMarkdownFile(editor, file);
			}
			e.target.value = "";
		};

		const handleExport = () => {
			if (editor) exportMarkdown(getMarkdown(), exportName);
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

		const handleImportUrl = (url: string, options: ImportUrlOpts) => {
			if (!editor || !onImportUrl) return;
			void onImportUrl(url, options).then((result) => {
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
						onChange={changeSource}
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
						{onImportUrl ? <ImportUrlButton onConfirm={handleImportUrl} /> : null}
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
			</div>
		);
	},
);
