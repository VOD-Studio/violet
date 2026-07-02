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
    /** 编辑器内部滚动容器，用于 BubbleMenu 监听滚动并更新位置 */
    scrollTarget?: HTMLElement | Window;
    /** 链接插入回调（由父组件打开输入弹窗） */
    onInsertLink: () => void;
}

/** 阻止 mousedown 让编辑器失焦（同 EditorToolbar 的 keepFocus） */
function keepFocus(e: MouseEvent) {
    e.preventDefault();
}

export function EditorBubbleMenu({ editor, scrollTarget, onInsertLink }: EditorBubbleMenuProps) {
    return (
        <BubbleMenu
            editor={editor}
            // updateDelay：选区变化后延迟定位，等编辑器布局稳定再测量，
            // 修复首次选中位置偏移（首次 rect 未稳定导致 Floating UI 计算错位）
            updateDelay={60}
            // resizeDelay：滚动/resize 时立即更新位置，避免菜单跟随延迟
            resizeDelay={0}
            // 仅在有实际文本选区时显示，避免光标态误触发
            shouldShow={({ state }) => {
                const { selection } = state;
                return !selection.empty && !editor.isActive("codeBlock");
            }}
            options={{
                placement: "top",
                offset: 8,
                // flip：顶部空间不足时自动翻转到下方
                flip: true,
                // shift：贴边时水平偏移，避免浮窗溢出视口
                shift: true,
                // scrollTarget：监听编辑器内部滚动容器，否则默认只监听 window，
                // 导致自定义 overflow-y-auto 容器内滚动时菜单不跟随。
                scrollTarget,
            }}
            className="z-50 flex items-center gap-0.5 rounded-lg border border-edge-hairline bg-popover p-1 shadow-lg"
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
