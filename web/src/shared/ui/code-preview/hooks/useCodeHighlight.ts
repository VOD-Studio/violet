/**
 * 代码高亮 Hook
 *
 * 使用 shiki 的 web 预设 bundle（shiki/bundle/web）的 codeToHtml，
 * 把代码文本转为带语法高亮的 HTML。管理加载/错误状态。
 *
 * 体积优化：用 shiki/bundle/web（仅含 web/通用语言）而非主 shiki 入口
 * （后者会把全部语言 grammar 打进构建产物，产生数百个 KB 级 chunk）。
 * bundle/web 整体打包，避免 hundreds of language chunks。
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

            // 动态加载 shiki web bundle 并高亮（bundle/web 的 codeToHtml 返回 Promise）
            const { codeToHtml } = await import("shiki/bundle/web");
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
