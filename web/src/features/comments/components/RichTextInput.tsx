/**
 * 富文本输入组件
 * 支持文字和表情混合输入，表情直接显示为图片
 */

import { forwardRef, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";
import { useRichTextInput } from "../hooks/useRichTextInput";

interface RichTextInputProps {
  /** 内容变化回调 */
  onChange?: (markdown: string) => void;
  /** 回车提交回调 */
  onSubmit?: () => void;
  /** 占位符 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义样式 */
  className?: string;
  /** 初始值 */
  initialValue?: string;
}

export interface RichTextInputRef {
  insertEmoji: (emojiName: string, emojiDisplay: string) => void;
  clear: () => void;
  getValue: () => string;
  setValue: (markdown: string) => void;
  focus: () => void;
}

/**
 * 富文本输入组件
 * 使用 contentEditable 实现表情直接显示
 */
export const RichTextInput = forwardRef<RichTextInputRef, RichTextInputProps>(
  (
    {
      onChange,
      onSubmit,
      placeholder = "写下你的评论...",
      disabled = false,
      className,
      initialValue,
    },
    ref
  ) => {
    const {
      contentRef,
      insertEmoji,
      handleInput,
      handlePaste,
      handleKeyDown,
      clear,
      getValue,
      setValue,
      focus,
    } = useRichTextInput({
      initialValue,
      onChange,
      onSubmit,
      disabled,
    });

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      insertEmoji,
      clear,
      getValue,
      setValue,
      focus,
    }));

    return (
      <div
        ref={contentRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        role="textbox"
        aria-label="评论内容"
        aria-multiline="true"
        className={cn(
          "min-h-24 max-h-60 overflow-y-auto",
          "px-4 py-3 text-sm",
          "bg-transparent",
          "focus:outline-none",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        suppressContentEditableWarning
      />
    );
  }
);

RichTextInput.displayName = "RichTextInput";
