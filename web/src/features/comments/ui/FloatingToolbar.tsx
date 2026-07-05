/**
 * FloatingToolbar - 选区浮动工具条（划线批注创建入口）。
 *
 * 高频路径，体感关键（PRD-0001 Issue-0006）。零跳转、所见即所得。
 *
 * 行为：
 *   - 监听 mouseup/selectionchange（防抖），选区非空时浮在选区正上方
 *   - 单块判定（selectionToAnchor）：单块 → 启用「划线批注」；跨块 → 置灰 + tooltip「请在同一段落内选择」
 *   - 已登录：点「划线批注」→ 弹出内联输入区（选中原文为引言）→ 提交（带 anchor）→ 高亮落定
 *   - 未登录：按钮变「登录后批注」，点击 login-dialog-store.open()
 *
 * 视觉：bg-surface-glass 毛玻璃 + 描边 + neon 强调。
 */

import { useLoginDialogStore } from "@features/auth/model/login-dialog-store";
import { useCreateComment } from "@features/comments/api/mutations";
import { toCreateCommentAnchor } from "@features/comments/lib/anchor-mapper";
import { clearSelection, selectionToAnchor } from "@features/comments/lib/selection-to-anchor";
import type { Anchor } from "@features/comments/lib/types";
import { ApiError } from "@shared/api/error";
import { Button } from "@shared/ui/base/button";
import { Textarea } from "@shared/ui/base/textarea";
import { Highlighter, Loader2, LogIn, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface FloatingToolbarProps {
    /** 正文容器 ref（选区必须在此容器内才显示工具条） */
    contentRef: React.RefObject<HTMLElement | null>;
    /** 当前是否登录（决定按钮文案与行为） */
    isLoggedIn: boolean;
    /** 文章 id（提交批注用） */
    postId: string;
}

/** 工具条位置 */
interface ToolbarPos {
    top: number;
    left: number;
}

export function FloatingToolbar({ contentRef, isLoggedIn, postId }: FloatingToolbarProps) {
    const [pos, setPos] = useState<ToolbarPos | null>(null);
    const [anchor, setAnchor] = useState<Anchor | null>(null);
    const [isCrossBlock, setIsCrossBlock] = useState(false);
    const [showInput, setShowInput] = useState(false);
    const [body, setBody] = useState("");
    const toolbarRef = useRef<HTMLDivElement>(null);
    const openLogin = useLoginDialogStore((s) => s.open);
    const createComment = useCreateComment(postId);

    // 监听选区变化（mouseup 后检查 selection）
    useEffect(() => {
        if (showInput) return; // 输入区展开时不响应新选区

        let rafId = 0;
        const handleSelectionChange = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(async () => {
                const root = contentRef.current;
                if (!root) return;

                const selection = window.getSelection();
                if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
                    setPos(null);
                    setAnchor(null);
                    setIsCrossBlock(false);
                    return;
                }

                // 选区必须在正文容器内
                const range = selection.getRangeAt(0);
                if (!root.contains(range.commonAncestorContainer)) {
                    setPos(null);
                    return;
                }

                // 算 anchor（含跨块判定）
                const result = await selectionToAnchor({ root });
                if (result) {
                    setAnchor(result);
                    setIsCrossBlock(false);
                } else {
                    setAnchor(null);
                    setIsCrossBlock(true);
                }

                // 定位工具条到选区上方
                const rect = range.getBoundingClientRect();
                setPos({
                    top: rect.top + window.scrollY - 48, // 选区上方 48px
                    left: rect.left + window.scrollX + rect.width / 2,
                });
            });
        };

        document.addEventListener("selectionchange", handleSelectionChange);
        return () => {
            document.removeEventListener("selectionchange", handleSelectionChange);
            cancelAnimationFrame(rafId);
        };
    }, [contentRef, showInput]);

    /** 点「划线批注」：登录展开输入区；未登录弹登录窗 */
    const handleAnnotate = () => {
        if (!isLoggedIn) {
            openLogin();
            return;
        }
        if (!anchor || isCrossBlock) return;
        setShowInput(true);
        setBody("");
    };

    /** 提交批注 */
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!anchor || !body.trim()) return;
        createComment.mutate(
            { body: body.trim(), anchor: toCreateCommentAnchor(anchor) },
            {
                onSuccess: () => {
                    toast.success("批注已提交，等待审核");
                    setShowInput(false);
                    setBody("");
                    setPos(null);
                    setAnchor(null);
                    clearSelection();
                },
                onError: (err) => {
                    const msg = err instanceof ApiError ? err.message : "提交失败";
                    toast.error(msg);
                },
            },
        );
    };

    /** 取消输入 */
    const handleCancel = () => {
        setShowInput(false);
        setBody("");
        setPos(null);
        setAnchor(null);
        clearSelection();
    };

    // 无选区或输入区关闭 → 不渲染
    if (!pos) return null;

    return (
        <div
            ref={toolbarRef}
            className="fixed z-50 -translate-x-1/2"
            style={{ top: pos.top, left: pos.left }}
            role="toolbar"
            aria-label="批注工具"
        >
            {showInput && anchor ? (
                /* 展开的输入区（选中原文为引言 + textarea + 提交/取消） */
                <form
                    onSubmit={handleSubmit}
                    className="w-80 rounded-lg border border-edge-hairline bg-surface-glass p-3 shadow-lg backdrop-blur"
                >
                    <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">划线批注</span>
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="取消"
                        >
                            <X className="size-3.5" />
                        </button>
                    </div>
                    {/* 引言区：选中原文 */}
                    <blockquote className="mb-2 border-l-2 border-primary/40 pl-2 text-xs italic text-muted-foreground line-clamp-2">
                        {anchor.selectedText}
                    </blockquote>
                    <Textarea
                        autoFocus
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="写下你的批注…"
                        rows={2}
                        disabled={createComment.isPending}
                        className="mb-2 text-sm"
                    />
                    <div className="flex justify-end gap-2">
                        <Button
                            type="submit"
                            size="sm"
                            disabled={createComment.isPending || !body.trim()}
                        >
                            {createComment.isPending ? (
                                <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                                <Highlighter className="size-3.5" />
                            )}
                            提交
                        </Button>
                    </div>
                </form>
            ) : (
                /* 浮动工具条（划线批注按钮） */
                <div className="flex items-center rounded-full border border-edge-hairline bg-surface-glass px-2 py-1 shadow-md backdrop-blur">
                    <button
                        type="button"
                        onClick={handleAnnotate}
                        disabled={isCrossBlock}
                        title={isCrossBlock ? "请在同一段落内选择" : "划线批注"}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isLoggedIn ? (
                            <>
                                <Highlighter className="size-3.5" />
                                划线批注
                            </>
                        ) : (
                            <>
                                <LogIn className="size-3.5" />
                                登录后批注
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}

export default FloatingToolbar;
