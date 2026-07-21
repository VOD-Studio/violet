/**
 * RichTextEditor - 受控富文本编辑器
 *
 * 受控 value/onChange（值为 Markdown 字符串）。内部用 Tiptap useEditor 管理
 * ProseMirror 状态，每次 update 调 onChange 回吐最新 Markdown。
 *
 * 能力：
 * - 顶部固定工具栏（历史/标题/格式/列表块/图片）
 * - 选中文本浮出迷你工具栏
 * - 输入 / 唤起斜杠命令菜单
 * - 拖拽/粘贴图片自动上传（purpose=post）并插入
 * - 底部状态栏：字数统计 + 导入/导出 MD 按钮 + MD 源码切换查看
 *
 * 图片插入（工具栏 + 斜杠菜单）通过 onPickImage 回调交由调用方决定如何选图，
 * 默认行为是打开本地上传文件选择器。
 */

import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { Code2, Download, FileUp, Globe } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { urlErrorMessage, validateUrl } from "@/shared/lib/url";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/base/button";
import { PromptDialog } from "@/shared/ui/prompt-dialog";
import { EditorBubbleMenu } from "./bubble-menu/EditorBubbleMenu";
import "./styles.css";
import { buildEditorExtensions } from "./extensions";
import { useEditorUpload } from "./hooks/useEditorUpload";
import { useTextareaScrollMirror } from "./hooks/useTextareaScrollMirror";
import { useWordCount } from "./hooks/useWordCount";
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
    /** 受控值（HTML 字符串，保留颜色/对齐等样式） */
    value: string;
    /** 值变更回调（HTML 字符串） */
    onChange: (html: string) => void;
    /** 占位符 */
    placeholder?: string;
    /** 导出 .md 时的文件名（不含扩展名） */
    exportName?: string;
    /** 自定义图片插入（工具栏+斜杠菜单点击图片时）；不传则用本地上传 */
    onPickImage?: () => void;
    /** 自定义远程链接导入；不传则不显示「链接」按钮。返回 null 表示取消或失败 */
    onImportUrl?: (url: string) => Promise<ImportUrlResult | null>;
    /** 远程链接导入成功后，把元信息（标题/摘要/SEO）透传给父级回填表单 */
    onImportUrlMeta?: (meta: ImportUrlMeta) => void;
    /** 外部 className */
    className?: string;
    /** 最小高度，默认 420 */
    minHeight?: number;
}

/** ImportUrlResult - 远程链接导入返回结构（编辑器只关心 html） */
export interface ImportUrlResult {
    /** 提取出的正文 HTML */
    html: string;
    /** 元信息（标题/摘要/SEO），透传给 onImportUrlMeta */
    meta?: ImportUrlMeta;
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
            placeholder,
            exportName = "article",
            onPickImage,
            onImportUrl,
            onImportUrlMeta,
            className,
            minHeight = 420,
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
                ...buildEditorExtensions(placeholder).filter((e) => e.name !== "slashCommand"),
                SlashCommand.configure({
                    onPickImage: handlePickImage,
                    items: (cb) => buildSlashItems(cb),
                }),
            ],
            content: value,
            contentType: "html" as const,
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
                // 用 HTML 序列化（保留颜色/对齐等 inline 样式，Markdown 会丢失这些）
                onChangeRef.current(editor.getHTML());
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
        // 回吐的 HTML 与父级 value 收敛后即停止，不会循环。
        // setTimeout 推迟到 React 提交完成后执行，避免 Tiptap 的 ReactNodeView
        // 在生命周期内 mount 时调用 flushSync 触发 React 警告。
        useEffect(() => {
            if (!editor) return;
            if (editor.isDestroyed || !editor.schema) return;
            const current = editor.getHTML();
            if (value === current) return;
            const timer = setTimeout(() => {
                if (editor.isDestroyed || !editor.schema) return;
                editor.commands.setContent(value || "", {
                    contentType: "html",
                    emitUpdate: true,
                });
            }, 0);
            return () => clearTimeout(timer);
        }, [value, editor]);

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
            editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
        };

        // —— Markdown 源码/编辑器内联切换 ——
        // 切换按「内容块」对齐滚动位置：富文本里一张大图 600px、源码里只有一行
        // `![](url)`,像素/比例对齐会错位。建立「顶层块 ↔ Markdown 起始行号」
        // 映射,切换时对齐到块起点(业界 Joplin/VS Code split-pane 同款)。
        const [sourceMode, setSourceMode] = useState(false);
        const [sourceText, setSourceText] = useState("");
        const textareaRef = useRef<HTMLTextAreaElement | null>(null);
        const { scrollToLine, getLineAtScrollTop } = useTextareaScrollMirror(textareaRef);
        // 进入源码时构建的块映射,退出源码时复用做行号→块 pos 反查
        const blockMapRef = useRef<ReadonlyArray<BlockLineEntry> | null>(null);
        // 进入源码后 textarea 要滚动到的目标行号
        const pendingSourceLineRef = useRef<number | null>(null);
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
                pendingSourceLineRef.current = visibleLine;
                setSourceMode(true);
            } else {
                // 退出源码模式:拿当前行号 → 二分找块 pos → 写回 → 切换
                const currentLine = getLineAtScrollTop();
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
        // 进入源码后 textarea mount → 滚到目标行
        useEffect(() => {
            if (sourceMode && pendingSourceLineRef.current != null) {
                const line = pendingSourceLineRef.current;
                pendingSourceLineRef.current = null;
                // textarea 刚 mount,镜像 div 还没建;下一帧再滚
                requestAnimationFrame(() => scrollToLine(line));
            }
        }, [sourceMode, scrollToLine]);
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
        const handleImportUrlConfirm = (url: string) => {
            if (!editor || !onImportUrl) return;
            const trimmed = url.trim();
            // 前端预校验：协议 + hostname 合法性，拦截非法域名结构避免往返后端才报错
            const reason = validateUrl(trimmed);
            if (reason) {
                setUrlError(urlErrorMessage(reason));
                return false;
            }
            setUrlError(null);
            // 校验通过：PromptDialog 关闭，解析异步进行；成功由 onImportUrl 调用方 toast
            void onImportUrl(trimmed).then((result) => {
                if (!result) return;
                if (result.html) {
                    editor.commands.setContent(result.html, { contentType: "html" });
                }
                // 元信息透传给父级回填表单（标题/摘要/SEO）
                if (result.meta && onImportUrlMeta) {
                    onImportUrlMeta(result.meta);
                }
            });
        };

        return (
            <div
                className={cn(
                    "flex h-full flex-col overflow-hidden rounded-lg border border-edge-hairline bg-background",
                    className,
                )}
            >
                <EditorToolbar
                    editor={editor}
                    onPickImage={handlePickImage}
                    onUploadImage={() => pickLocalFileRef.current?.()}
                    onInsertLink={openLinkDialog}
                />
                {editor ? <TableToolbar editor={editor} /> : null}
                {sourceMode ? (
                    <textarea
                        ref={textareaRef}
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        spellCheck={false}
                        className="flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed focus:outline-none"
                        style={{ minHeight }}
                    />
                ) : (
                    <div
                        ref={setScrollContainer}
                        className="relative flex-1 overflow-y-auto px-4 py-3"
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
                        {onImportUrl ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                title="导入远程链接文档"
                                onClick={() => setUrlDialogOpen(true)}
                            >
                                <Globe /> 链接
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            title="导出为 .md"
                            onClick={handleExport}
                        >
                            <Download /> 导出
                        </Button>
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
                {/* 远程链接导入弹窗 */}
                <PromptDialog
                    open={urlDialogOpen}
                    onOpenChange={setUrlDialogOpen}
                    title="导入远程链接"
                    description="粘贴网页地址，解析正文并替换当前内容"
                    label="网页 URL"
                    defaultValue="https://"
                    placeholder="https://example.com/article"
                    confirmLabel="导入"
                    onConfirm={handleImportUrlConfirm}
                    error={urlError ?? undefined}
                    onValueChange={() => setUrlError(null)}
                />
            </div>
        );
    },
);
