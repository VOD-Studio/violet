/**
 * EmojiText - 表情文本渲染组件
 *
 * 将文本中的 [name] 占位符替换为内联表情图片。使用 React 元素渲染（非 innerHTML），
 * 文本段由 React 自动转义，无 XSS 风险。
 *
 * emote 映射由后端 CommentDTO.emote 提供，key 为含方括号的完整占位符（如 "[doge]"）。
 * 未匹配的 [name] 保持原文显示。
 */
import type { CommentEmoteRef } from "@entities/comment/model/types";
import { isImageURL } from "@shared/lib/url";
import { Fragment, type ReactNode } from "react";

export interface EmojiTextProps {
    /** 待解析的文本，可能包含 [name] 占位符 */
    text: string;
    /** 表情映射表，key 为 "[name]"，value 为图片 URL */
    emote?: Record<string, CommentEmoteRef>;
    /** 外层样式 */
    className?: string;
}

const EMOJI_PATTERN = /\[([^\]]+)\]/g;

export function EmojiText({ text, emote, className }: EmojiTextProps) {
    return <span className={className}>{parseEmojiText(text, emote)}</span>;
}

function parseEmojiText(text: string, emote?: Record<string, CommentEmoteRef>): ReactNode[] {
    if (!emote || text.length === 0) {
        return [text];
    }

    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    EMOJI_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null = EMOJI_PATTERN.exec(text);
    while (match !== null) {
        const [fullMatch] = match;
        const startIndex = match.index;

        if (startIndex > lastIndex) {
            nodes.push(<Fragment key={key++}>{text.slice(lastIndex, startIndex)}</Fragment>);
        }

        const ref = emote[fullMatch];
        if (ref) {
            const src = ref.gif_url || ref.url;
            if (src && isImageURL(src)) {
                nodes.push(
                    <img
                        key={key++}
                        src={src}
                        alt={fullMatch}
                        className="inline-block size-5 align-text-bottom"
                        loading="lazy"
                    />,
                );
            } else {
                nodes.push(<Fragment key={key++}>{src || fullMatch}</Fragment>);
            }
        } else {
            nodes.push(<Fragment key={key++}>{fullMatch}</Fragment>);
        }

        lastIndex = startIndex + fullMatch.length;
        match = EMOJI_PATTERN.exec(text);
    }

    if (lastIndex < text.length) {
        nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
    }

    return nodes.length > 0 ? nodes : [text];
}
