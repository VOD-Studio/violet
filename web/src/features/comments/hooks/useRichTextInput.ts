/**
 * 富文本输入 Hook
 * 管理 contentEditable 状态和表情插入逻辑
 */

import { useRef, useCallback, useEffect } from "react";
import { useEmojis } from "@/hooks/useEmojis";

interface UseRichTextInputOptions {
  /** 初始值 */
  initialValue?: string;
  /** 内容变化回调 */
  onChange?: (markdown: string) => void;
  /** 回车提交回调 */
  onSubmit?: () => void;
  /** 是否禁用 */
  disabled?: boolean;
}

export function useRichTextInput({
  initialValue = "",
  onChange,
  onSubmit,
  disabled = false,
}: UseRichTextInputOptions = {}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { getDisplayByName } = useEmojis();

  /**
   * 将 Markdown 文本转换为 HTML（用于初始化）
   */
  const markdownToHtml = useCallback(
    (markdown: string): string => {
      if (!markdown) return "";

      // 匹配 [emoji_name] 语法
      const emojiRegex = /\[([^\]]+)\]/g;
      let html = "";
      let lastIndex = 0;

      markdown.replace(emojiRegex, (match, emojiName, index) => {
        // 添加前面的文本
        if (index > lastIndex) {
          html += markdown.slice(lastIndex, index);
        }

        // 获取表情显示内容
        const display = getDisplayByName(emojiName);
        if (display) {
          // 判断是图片还是文本
          if (
            display.startsWith("http") ||
            display.startsWith("/")
          ) {
            html += `<img src="${display}" alt="${emojiName}" data-emoji="${emojiName}" class="inline-block w-5 h-5 align-text-bottom mx-0.5" />`;
          } else {
            html += `<span data-emoji="${emojiName}" class="inline-block mx-0.5">${display}</span>`;
          }
        } else {
          // 表情不存在，保留原文
          html += match;
        }

        lastIndex = index + match.length;
        return match;
      });

      // 添加剩余文本
      if (lastIndex < markdown.length) {
        html += markdown.slice(lastIndex);
      }

      return html;
    },
    [getDisplayByName]
  );

  /**
   * 将 contentEditable 的 DOM 转换为 Markdown
   */
  const htmlToMarkdown = useCallback((): string => {
    const div = contentRef.current;
    if (!div) return "";

    let markdown = "";

    const traverse = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        markdown += node.textContent || "";
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;

        if (element.tagName === "IMG" || element.tagName === "SPAN") {
          const emojiName = element.dataset.emoji;
          if (emojiName) {
            markdown += `[${emojiName}]`;
          }
        } else if (element.tagName === "BR") {
          markdown += "\n";
        } else if (element.tagName === "DIV") {
          // 处理换行（contentEditable 可能生成 div）
          if (markdown && !markdown.endsWith("\n")) {
            markdown += "\n";
          }
          element.childNodes.forEach(traverse);
        } else {
          // 其他元素递归处理子节点
          element.childNodes.forEach(traverse);
        }
      }
    };

    div.childNodes.forEach(traverse);
    return markdown.trim();
  }, []);

  /**
   * 插入表情到光标位置
   */
  const insertEmoji = useCallback(
    (emojiName: string, emojiDisplay: string) => {
      const div = contentRef.current;
      if (!div || disabled) return;

      div.focus();

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        // 没有选区，追加到末尾
        const element = createEmojiElement(emojiName, emojiDisplay);
        div.appendChild(element);
        div.appendChild(document.createTextNode(" "));
      } else {
        const range = selection.getRangeAt(0);
        range.deleteContents();

        const element = createEmojiElement(emojiName, emojiDisplay);
        range.insertNode(element);

        // 在表情后插入空格
        const space = document.createTextNode(" ");
        range.setStartAfter(element);
        range.insertNode(space);

        // 光标移到空格后
        range.setStartAfter(space);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      // 触发 onChange
      const markdown = htmlToMarkdown();
      onChange?.(markdown);
    },
    [disabled, htmlToMarkdown, onChange]
  );

  /**
   * 创建表情元素
   */
  function createEmojiElement(
    emojiName: string,
    emojiDisplay: string
  ): HTMLElement {
    if (
      emojiDisplay.startsWith("http") ||
      emojiDisplay.startsWith("/")
    ) {
      const img = document.createElement("img");
      img.src = emojiDisplay;
      img.alt = emojiName;
      img.dataset.emoji = emojiName;
      img.className = "inline-block w-5 h-5 align-text-bottom mx-0.5";
      img.draggable = false;
      return img;
    } else {
      const span = document.createElement("span");
      span.textContent = emojiDisplay;
      span.dataset.emoji = emojiName;
      span.className = "inline-block mx-0.5";
      return span;
    }
  }

  /**
   * 处理输入事件
   */
  const handleInput = useCallback(() => {
    const markdown = htmlToMarkdown();
    onChange?.(markdown);
  }, [htmlToMarkdown, onChange]);

  /**
   * 处理粘贴事件（只保留纯文本）
   */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
    },
    []
  );

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ctrl/Cmd + Enter 提交
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        onSubmit?.();
      }
    },
    [onSubmit]
  );

  /**
   * 清空内容
   */
  const clear = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.innerHTML = "";
      onChange?.("");
    }
  }, [onChange]);

  /**
   * 获取当前内容
   */
  const getValue = useCallback(() => {
    return htmlToMarkdown();
  }, [htmlToMarkdown]);

  /**
   * 设置内容
   */
  const setValue = useCallback(
    (markdown: string) => {
      if (contentRef.current) {
        contentRef.current.innerHTML = markdownToHtml(markdown);
      }
    },
    [markdownToHtml]
  );

  /**
   * 聚焦输入框
   */
  const focus = useCallback(() => {
    contentRef.current?.focus();
  }, []);

  // 初始化内容
  useEffect(() => {
    if (contentRef.current && initialValue) {
      contentRef.current.innerHTML = markdownToHtml(initialValue);
    }
  }, [initialValue, markdownToHtml]);

  return {
    contentRef,
    insertEmoji,
    handleInput,
    handlePaste,
    handleKeyDown,
    clear,
    getValue,
    setValue,
    focus,
  };
}
