/**
 * TableToolbar - 表格操作浮动条
 *
 * 当光标处于表格内时显示，提供行列增删、合并/拆分、删除表格等操作。
 * Tiptap 表格默认无 UI，需自行提供这些命令入口（#5）。
 */
import type { Editor } from "@tiptap/react";
import { Columns2, Grid2x2, Rows2, Table as TableIcon, Trash2, Undo2 } from "lucide-react";
import type { MouseEvent } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/base/button";

interface TableToolbarProps {
    editor: Editor;
}

/** 阻止 mousedown 让编辑器失焦 */
function keepFocus(e: MouseEvent) {
    e.preventDefault();
}

export function TableToolbar({ editor }: TableToolbarProps) {
    if (!editor.isActive("table")) return null;

    const canMerge = editor.can().mergeCells();
    const canSplit = editor.can().splitCell();

    return (
        <div
            className="flex flex-wrap items-center gap-0.5 border-b border-edge-hairline bg-muted/40 px-2 py-1"
            // 容器统一拦截 mousedown，避免按钮点击让编辑器失焦
            onMouseDown={keepFocus}
        >
            <span className="px-1 text-[11px] text-muted-foreground">
                <TableIcon className="mr-1 inline size-3" />
                表格
            </span>
            <span className="mx-0.5 h-4 w-px bg-edge-hairline" aria-hidden />
            <Button
                variant="ghost"
                size="xs"
                title="上方插入行"
                onClick={() => editor.chain().focus().addRowBefore().run()}
            >
                <Rows2 /> 上行
            </Button>
            <Button
                variant="ghost"
                size="xs"
                title="下方插入行"
                onClick={() => editor.chain().focus().addRowAfter().run()}
            >
                <Rows2 className="rotate-180" /> 下行
            </Button>
            <span className="mx-0.5 h-4 w-px bg-edge-hairline" aria-hidden />
            <Button
                variant="ghost"
                size="xs"
                title="左侧插入列"
                onClick={() => editor.chain().focus().addColumnBefore().run()}
            >
                <Columns2 /> 左列
            </Button>
            <Button
                variant="ghost"
                size="xs"
                title="右侧插入列"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
                <Columns2 className="rotate-180" /> 右列
            </Button>
            <span className="mx-0.5 h-4 w-px bg-edge-hairline" aria-hidden />
            <Button
                variant="ghost"
                size="xs"
                title="合并单元格"
                disabled={!canMerge}
                onClick={() => editor.chain().focus().mergeCells().run()}
            >
                <Grid2x2 /> 合并
            </Button>
            <Button
                variant="ghost"
                size="xs"
                title="拆分单元格"
                disabled={!canSplit}
                onClick={() => editor.chain().focus().splitCell().run()}
            >
                <Undo2 /> 拆分
            </Button>
            <span className="mx-0.5 h-4 w-px bg-edge-hairline" aria-hidden />
            <Button
                variant="ghost"
                size="xs"
                title="删除当前行"
                onClick={() => editor.chain().focus().deleteRow().run()}
            >
                <Rows2 /> 删行
            </Button>
            <Button
                variant="ghost"
                size="xs"
                title="删除当前列"
                onClick={() => editor.chain().focus().deleteColumn().run()}
            >
                <Columns2 /> 删列
            </Button>
            <Button
                variant="ghost"
                size="xs"
                title="删除整张表格"
                className={cn("text-destructive hover:text-destructive")}
                onClick={() => editor.chain().focus().deleteTable().run()}
            >
                <Trash2 /> 删表
            </Button>
        </div>
    );
}
