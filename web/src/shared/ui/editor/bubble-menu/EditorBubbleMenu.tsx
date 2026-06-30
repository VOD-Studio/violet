/**
 * EditorBubbleMenu - 选中文本浮出的迷你工具栏
 *
 * 选中任意文本时出现，提供最常用的快速格式化：粗体 / 斜体 / 行内代码 / 链接。
 * 基于 Tiptap BubbleMenu，自动跟随选区定位。
 */
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Code, Italic, Link as LinkIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

interface EditorBubbleMenuProps {
    editor: Editor;
    /** 链接插入回调（由父组件打开输入弹窗） */
    onInsertLink: () => void;
}

/** 阻止 mousedown 让编辑器失焦（同 EditorToolbar 的 keepFocus） */
function keepFocus(e: MouseEvent) {
    e.preventDefault();
}

export function EditorBubbleMenu({ editor, onInsertLink }: EditorBubbleMenuProps) {
    return (
        <BubbleMenu
            editor={editor}
            options={{ placement: "bottom", offset: 8 }}
            className="flex items-center gap-0.5 rounded-lg border border-edge-hairline bg-popover p-1 shadow-lg"
            // BubbleMenu 自身点击不应收起选区
            onMouseDown={keepFocus}
        >
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={cn(editor.isActive("bold") && "bg-accent")}
            >
                <Bold />
            </Button>
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={cn(editor.isActive("italic") && "bg-accent")}
            >
                <Italic />
            </Button>
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={cn(editor.isActive("code") && "bg-accent")}
            >
                <Code />
            </Button>
            <Button
                variant="ghost"
                size="icon-sm"
                onClick={onInsertLink}
                className={cn(editor.isActive("link") && "bg-accent")}
            >
                <LinkIcon />
            </Button>
        </BubbleMenu>
    );
}
