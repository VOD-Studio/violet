/**
 * useRichTextInput - contentEditable 富文本输入 Hook
 *
 * 管理 contentEditable div 的核心逻辑：
 * - DOM ↔ Markdown 双向转换（[name] ↔ img/span 元素）
 * - Selection/Range API 管理光标位置
 * - emoji 插入到光标处
 * - 粘贴强制纯文本
 * - Cmd/Ctrl+Enter 触发提交
 * - 受控同步：外部 value 变化时同步 DOM，用户输入时不重置光标
 *
 * emoji 查表使用 useAllEmojis 构建 name→Emoji 映射。
 * 图片表情用 <img data-emoji>，颜文字用 <span data-emoji>。
 */
import { useAllEmojis } from "@features/emojis/api/queries";
import type { Emoji } from "@entities/emoji/model/types";
import { isImageURL } from "@shared/lib/url";
import { useCallback, useEffect, useMemo, useRef } from "react";

export interface UseRichTextInputOptions {
    value: string;
    onChange?: (markdown: string) => void;
    onSubmit?: () => void;
    disabled?: boolean;
}

export interface UseRichTextInputReturn {
    contentRef: React.RefObject<HTMLDivElement | null>;
    insertEmoji: (name: string, display: string) => void;
    handleInput: () => void;
    handlePaste: (e: React.ClipboardEvent) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    clear: () => void;
    focus: () => void;
}

const EMOJI_PATTERN = /\[([^\]]+)\]/g;

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function useRichTextInput({ value, onChange, onSubmit, disabled }: UseRichTextInputOptions): UseRichTextInputReturn {
    const contentRef = useRef<HTMLDivElement>(null);
    const lastSyncedRef = useRef(value);
    const onChangeRef = useRef(onChange);
    const onSubmitRef = useRef(onSubmit);
    onChangeRef.current = onChange;
    onSubmitRef.current = onSubmit;

    const { data: groups = [] } = useAllEmojis();

    const emojiMap = useMemo(() => {
        const map = new Map<string, Emoji>();
        for (const group of groups) {
            for (const emoji of group.emojis) {
                map.set(emoji.name, emoji);
            }
        }
        return map;
    }, [groups]);

    const getDisplayUrl = useCallback(
        (name: string): string => {
            const emoji = emojiMap.get(name);
            if (!emoji) return "";
            const url = emoji.gif_url || emoji.url;
            return url && isImageURL(url) ? url : "";
        },
        [emojiMap],
    );

    const markdownToHtml = useCallback(
        (markdown: string): string => {
            if (!markdown) return "";
            let html = "";
            let lastIndex = 0;
            EMOJI_PATTERN.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = EMOJI_PATTERN.exec(markdown)) !== null) {
                const [fullMatch] = match;
                if (match.index > lastIndex) {
                    html += escapeHtml(markdown.slice(lastIndex, match.index)).replace(/\n/g, "<br>");
                }
                const url = getDisplayUrl(fullMatch);
                if (url) {
                    html += `<img src="${url}" alt="${escapeHtml(fullMatch)}" data-emoji="${escapeHtml(fullMatch)}" class="inline-block size-5 align-text-bottom" draggable="false" />`;
                } else {
                    const emoji = emojiMap.get(fullMatch);
                    const text = emoji?.text_content || fullMatch;
                    html += `<span data-emoji="${escapeHtml(fullMatch)}">${escapeHtml(text)}</span>`;
                }
                lastIndex = match.index + fullMatch.length;
            }
            if (lastIndex < markdown.length) {
                html += escapeHtml(markdown.slice(lastIndex)).replace(/\n/g, "<br>");
            }
            return html;
        },
        [getDisplayUrl, emojiMap],
    );

    const htmlToMarkdown = useCallback((): string => {
        const div = contentRef.current;
        if (!div) return "";
        let markdown = "";
        const traverse = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                markdown += node.textContent || "";
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (el.tagName === "IMG" || el.tagName === "SPAN") {
                    const emojiName = el.dataset.emoji;
                    if (emojiName) {
                        markdown += emojiName;
                    }
                } else if (el.tagName === "BR") {
                    markdown += "\n";
                } else if (el.tagName === "DIV") {
                    if (markdown && !markdown.endsWith("\n")) {
                        markdown += "\n";
                    }
                    el.childNodes.forEach(traverse);
                } else {
                    el.childNodes.forEach(traverse);
                }
            }
        };
        div.childNodes.forEach(traverse);
        return markdown;
    }, []);

    const syncToDom = useCallback(
        (markdown: string) => {
            if (contentRef.current) {
                contentRef.current.innerHTML = markdownToHtml(markdown);
                lastSyncedRef.current = markdown;
            }
        },
        [markdownToHtml],
    );

    // 外部 value 变化时同步 DOM（用户输入触发的变化不重置）
    useEffect(() => {
        if (value !== lastSyncedRef.current) {
            syncToDom(value);
        }
    }, [value, syncToDom]);

    // 初始化
    useEffect(() => {
        if (contentRef.current && value && !contentRef.current.innerHTML) {
            syncToDom(value);
        }
        // biome-ignore lint/correctness/useExhaustiveDependencies: 仅初始化时执行
    }, [syncToDom]);

    const insertEmoji = useCallback(
        (name: string, display: string) => {
            const div = contentRef.current;
            if (!div || disabled) return;
            div.focus();

            const element = createEmojiElement(name, display);

            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || !div.contains(selection.anchorNode)) {
                div.appendChild(element);
            } else {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(element);
                range.setStartAfter(element);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }

            lastSyncedRef.current = htmlToMarkdown();
            onChangeRef.current?.(lastSyncedRef.current);
        },
        [disabled, htmlToMarkdown],
    );

    const handleInput = useCallback(() => {
        const markdown = htmlToMarkdown();
        lastSyncedRef.current = markdown;
        onChangeRef.current?.(markdown);
    }, [htmlToMarkdown]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
        handleInput();
    }, [handleInput]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            onSubmitRef.current?.();
        }
    }, []);

    const clear = useCallback(() => {
        if (contentRef.current) {
            contentRef.current.innerHTML = "";
        }
        lastSyncedRef.current = "";
        onChangeRef.current?.("");
    }, []);

    const focus = useCallback(() => {
        contentRef.current?.focus();
    }, []);

    return { contentRef, insertEmoji, handleInput, handlePaste, handleKeyDown, clear, focus };
}

function createEmojiElement(name: string, display: string): HTMLElement {
    if (display && isImageURL(display)) {
        const img = document.createElement("img");
        img.src = display;
        img.alt = name;
        img.dataset.emoji = name;
        img.className = "inline-block size-5 align-text-bottom";
        img.draggable = false;
        return img;
    }
    const span = document.createElement("span");
    span.textContent = display || name;
    span.dataset.emoji = name;
    span.className = "inline-block";
    return span;
}
