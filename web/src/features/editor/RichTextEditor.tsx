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
import { EditorContent, useEditor } from "@tiptap/react";
import { Download, FileText, FileUp } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { PromptDialog } from "@/shared/ui/prompt-dialog";
import { EditorBubbleMenu } from "./bubble-menu/EditorBubbleMenu";
import "./styles.css";
import { buildEditorExtensions } from "./extensions";
import { useEditorUpload } from "./hooks/useEditorUpload";
import { useWordCount } from "./hooks/useWordCount";
import { exportMarkdown, importMarkdownFile } from "./lib/markdown-utils";
import { SlashCommand } from "./slash-menu/SlashCommand";
import { buildSlashItems } from "./slash-menu/slash-items";
import { EditorToolbar } from "./toolbar/EditorToolbar";
import { TableToolbar } from "./toolbar/TableToolbar";

/** 命令式句柄：供父组件插入图片、取值等 */
export interface RichTextEditorHandle {
    /** 在光标处插入多张图片 */
    insertImages: (images: Array<{ src: string; alt?: string }>) => void;
    /** 取当前 Markdown */
    getMarkdown: () => string;
}

export interface RichTextEditorProps {
    /** 受控值（Markdown 字符串） */
    value: string;
    /** 值变更回调（Markdown 字符串） */
    onChange: (md: string) => void;
    /** 占位符 */
    placeholder?: string;
    /** 导出 .md 时的文件名（不含扩展名） */
    exportName?: string;
    /** 自定义图片插入（工具栏+斜杠菜单点击图片时）；不传则用本地上传 */
    onPickImage?: () => void;
    /** 外部 className */
    className?: string;
    /** 最小高度，默认 420 */
    minHeight?: number;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
    function RichTextEditor(
        {
            value,
            onChange,
            placeholder,
            exportName = "article",
            onPickImage,
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
            contentType: "markdown" as const,
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
                onChangeRef.current(editor.getMarkdown());
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
                getMarkdown: () => editor?.getMarkdown() ?? "",
            }),
            [editor],
        );

        // 外部 value 变更时同步进编辑器（仅在差异时，避免光标跳动）
        useEffect(() => {
            if (!editor) return;
            const current = editor.getMarkdown();
            if (value !== current) {
                editor.commands.setContent(value || "", {
                    contentType: "markdown",
                    emitUpdate: false,
                });
            }
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

        // —— Markdown 源码查看/编辑弹窗 ——
        const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
        const [sourceDefault, setSourceDefault] = useState("");
        const openSourceDialog = () => {
            if (!editor) return;
            setSourceDefault(editor.getMarkdown());
            setSourceDialogOpen(true);
        };
        const handleSourceConfirm = (md: string) => {
            if (editor && md !== sourceDefault) {
                editor.commands.setContent(md, { contentType: "markdown" });
            }
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
                <div className="flex-1 overflow-y-auto px-4 py-3">
                    {editor ? (
                        <EditorBubbleMenu editor={editor} onInsertLink={openLinkDialog} />
                    ) : null}
                    <EditorContent editor={editor} />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-edge-hairline bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                    <span>{wordCount} 字</span>
                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            title="查看/编辑 Markdown 源码"
                            onClick={openSourceDialog}
                        >
                            <FileText /> 源码
                        </Button>
                        <label>
                            <input
                                type="file"
                                accept=".md,.markdown,.txt"
                                className="hidden"
                                onChange={handleImport}
                            />
                            <span
                                className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                                title="导入 .md 文件"
                            >
                                <FileUp /> 导入
                            </span>
                        </label>
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
                {/* Markdown 源码查看/编辑弹窗 */}
                <PromptDialog
                    open={sourceDialogOpen}
                    onOpenChange={setSourceDialogOpen}
                    title="Markdown 源码"
                    description="查看或直接编辑 Markdown 源码"
                    multiline
                    defaultValue={sourceDefault}
                    confirmLabel="应用"
                    onConfirm={handleSourceConfirm}
                />
            </div>
        );
    },
);
