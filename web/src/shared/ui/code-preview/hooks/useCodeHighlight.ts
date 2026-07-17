/**
 * 代码高亮 Hook
 *
 * 从 URL 拉取代码文本，用共享 highlighter 单例（lib/highlighter）高亮为 HTML。
 * 与文章正文（useShikiHighlight）复用同一 highlighter 实例，主题 github-dark。
 *
 * 语言按白名单按需加载，bundle/web 不再进入构建产物。
 */

import { useCallback, useEffect, useState } from "react";
import { highlightCode } from "../lib/highlighter";
import type { CodeLoadStatus } from "../types/code-preview-types";

interface UseCodeHighlightOptions {
    url: string;
    language: string;
}

export function useCodeHighlight({ url, language }: UseCodeHighlightOptions) {
    const [html, setHtml] = useState("");
    const [loadStatus, setLoadStatus] = useState<CodeLoadStatus>("loading");

    const highlight = useCallback(async () => {
        setLoadStatus("loading");
        try {
            // 拉取代码文本
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const code = await res.text();

            // 共享 highlighter 单例高亮（语言按白名单按需加载）
            const highlighted = await highlightCode(code, language);
            setHtml(highlighted);
            setLoadStatus("ready");
        } catch {
            setLoadStatus("error");
        }
    }, [url, language]);

    useEffect(() => {
        void highlight();
    }, [highlight]);

    const retry = useCallback(() => {
        void highlight();
    }, [highlight]);

    return { html, loadStatus, retry };
}
