/**
 * 代码高亮 Hook
 *
 * 使用 shiki 的 codeToHtml（动态 import，按需加载语言与主题），
 * 把代码文本转为带语法高亮的 HTML。管理加载/错误状态。
 *
 * shiki 单文件模式：codeToHtml 内部按需加载指定的语言与主题 bundle，
 * 避免打包全部语言，体积可控。
 */

import { useCallback, useEffect, useState } from "react";
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

            // 动态加载 shiki 并高亮（按需加载语言/主题）
            const { codeToHtml } = await import("shiki");
            const highlighted = await codeToHtml(code, {
                lang: language,
                theme: "github-dark",
            });

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
