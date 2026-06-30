/**
 * EditorToolbar - 富文本编辑器顶部工具栏
 *
 * 固定在编辑区上方，按分组渲染按钮：历史 / 标题 / 文本格式 / 列表与块。
 * 图片按钮单独处理（需触发上传/素材选择，故由父组件注入回调）。
 * 按钮基于编辑器命令的 active 态高亮、disabled 态置灰。
 */
import type { Editor } from "@tiptap/react";
import { ImagePlus } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { allToolbarItems, TOOLBAR_DIVIDER, type ToolbarItem } from "./toolbar-items";

interface EditorToolbarProps {
    editor: Editor | null;
    /** 图片插入回调（由父组件注入：弹出素材选择/本地上传菜单） */
    onPickImage: () => void;
}

export function EditorToolbar({ editor, onPickImage }: EditorToolbarProps) {
    if (!editor) return null;

    const renderItem = (item: ToolbarItem | typeof TOOLBAR_DIVIDER, idx: number) => {
        if (item === TOOLBAR_DIVIDER) {
            return (
                <span
                    key={`d-${idx}`}
                    className="mx-0.5 h-5 w-px shrink-0 bg-edge-hairline"
                    aria-hidden
                />
            );
        }
        const Icon = item.icon;
        const active = item.isActive(editor);
        const disabled = item.canRun ? !item.canRun(editor) : false;
        return (
            <Button
                key={item.id}
                type="button"
                variant="ghost"
                size="icon-sm"
                title={item.title}
                disabled={disabled}
                onClick={() => item.run(editor)}
                className={cn(active && "bg-accent text-accent-foreground")}
            >
                <Icon />
            </Button>
        );
    };

    return (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-edge-hairline bg-background/80 px-2 py-1.5 backdrop-blur">
            {allToolbarItems.map(renderItem)}
            <span className="mx-0.5 h-5 w-px shrink-0 bg-edge-hairline" aria-hidden />
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="插入图片"
                onClick={onPickImage}
            >
                <ImagePlus />
            </Button>
        </div>
    );
}
