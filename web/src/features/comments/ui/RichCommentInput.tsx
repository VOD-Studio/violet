/**
 * RichCommentInput - 自包含富文本评论输入组件
 *
 * contentEditable 输入区 + 底部工具栏（emoji 按钮）。图片上传在 Issue 003 中添加。
 *
 * 受控 API：value/onChange 管理纯文本内容（emoji 为 [name] 占位符）。
 * 工具栏 emoji 按钮复用 EmojiPicker 组件，选择后在光标处插入内联表情图片。
 *
 * compact 模式减小 padding/字号，用于回复框和批注。
 * enableEmoji 控制是否显示 emoji 按钮（默认 true）。
 */
import type { Emoji } from "@entities/emoji/model/types";
import { EmojiPicker } from "@features/emojis/ui/EmojiPicker";
import { isImageURL } from "@shared/lib/url";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { ReactNode } from "react";
import { useRichTextInput } from "../hooks/use-rich-text-input";

export interface RichCommentInputProps {
    /** 当前值（纯文本，emoji 为 [name] 占位符） */
    value: string;
    /** 值变化回调 */
    onChange: (value: string) => void;
    /** Cmd/Ctrl+Enter 提交回调 */
    onSubmit?: () => void;
    /** 最大图片数（Issue 003 实现，本期忽略） */
    maxImages?: number;
    /** 是否显示 emoji 按钮，默认 true */
    enableEmoji?: boolean;
    /** 是否显示图片按钮（Issue 003 实现，本期渲染但禁用） */
    enableImage?: boolean;
    /** 紧凑模式（回复框/批注） */
    compact?: boolean;
    /** 禁用 */
    disabled?: boolean;
    /** 占位符文本 */
    placeholder?: string;
    /** 自定义底部工具栏内容（右侧） */
    toolbarEnd?: ReactNode;
}

export function RichCommentInput({
    value,
    onChange,
    onSubmit,
    enableEmoji = true,
    enableImage = false,
    compact = false,
    disabled = false,
    placeholder = "写下你的评论…",
    toolbarEnd,
}: RichCommentInputProps) {
    const { contentRef, insertEmoji, handleInput, handlePaste, handleKeyDown } = useRichTextInput({
        value,
        onChange,
        onSubmit,
        disabled,
    });

    const handleEmojiSelect = (emoji: Emoji) => {
        const imageUrl = emoji.gif_url || emoji.url;
        if (imageUrl && isImageURL(imageUrl)) {
            insertEmoji(emoji.name, imageUrl);
        } else {
            insertEmoji(emoji.name, emoji.text_content || emoji.name);
        }
    };

    return (
        <div
            className={cn(
                "rounded-lg border border-edge-hairline bg-background",
                "focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20",
                "transition-all",
                disabled && "opacity-50",
            )}
        >
            <div
                ref={contentRef}
                contentEditable={!disabled}
                onInput={handleInput}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                data-placeholder={placeholder}
                role="textbox"
                aria-multiline="true"
                aria-label="评论内容"
                suppressContentEditableWarning
                className={cn(
                    "max-h-60 overflow-y-auto bg-transparent focus:outline-none",
                    compact ? "min-h-10 px-3 py-2 text-sm" : "min-h-24 px-4 py-3 text-sm",
                    "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
                )}
            />

            <div className="flex items-center justify-between border-t border-edge-hairline px-2 py-1">
                <div className="flex items-center gap-1">
                    {enableEmoji && (
                        <EmojiPicker
                            onSelect={handleEmojiSelect}
                            align="start"
                        />
                    )}
                    {enableImage && (
                        <button
                            type="button"
                            disabled
                            title="图片上传即将支持"
                            className="inline-flex size-7 items-center justify-center rounded text-muted-foreground opacity-40"
                        >
                            <ImageIcon className="size-3.5" />
                        </button>
                    )}
                </div>
                {toolbarEnd}
            </div>
        </div>
    );
}
