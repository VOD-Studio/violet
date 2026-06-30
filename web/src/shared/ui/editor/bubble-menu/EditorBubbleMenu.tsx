/**
 * EditorBubbleMenu - 选中文本浮出的迷你工具栏
 *
 * 选中任意文本时出现，提供最常用的快速格式化：粗体 / 斜体 / 行内代码 / 链接。
 * 基于 Tiptap BubbleMenu，自动跟随选区定位。
 */
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Code, Italic, Link as LinkIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

interface EditorBubbleMenuProps {
    editor: Editor;
}

export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
    const setLink = () => {
        const prev = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("链接地址", prev ?? "https://");
        if (url === null) return;
        if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    };

    return (
        <BubbleMenu
            editor={editor}
            options={{ placement: "top", offset: 8 }}
            className="flex items-center gap-0.5 rounded-lg border border-edge-hairline bg-popover p-1 shadow-lg"
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
                onClick={setLink}
                className={cn(editor.isActive("link") && "bg-accent")}
            >
                <LinkIcon />
            </Button>
        </BubbleMenu>
    );
}
