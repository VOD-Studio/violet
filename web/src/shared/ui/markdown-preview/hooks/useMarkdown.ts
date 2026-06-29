/**
 * Markdown 源码加载 Hook
 *
 * fetch Markdown 文件文本，管理加载/错误状态。
 */

import { useCallback, useEffect, useState } from "react";
import type { MarkdownLoadStatus } from "../types/markdown-preview-types";

interface UseMarkdownOptions {
    url: string;
}

export function useMarkdown({ url }: UseMarkdownOptions) {
    const [source, setSource] = useState("");
    const [loadStatus, setLoadStatus] = useState<MarkdownLoadStatus>("loading");

    const load = useCallback(async () => {
        setLoadStatus("loading");
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            setSource(text);
            setLoadStatus("ready");
        } catch {
            setLoadStatus("error");
        }
    }, [url]);

    useEffect(() => {
        void load();
    }, [load]);

    const retry = useCallback(() => {
        void load();
    }, [load]);

    return { source, loadStatus, retry };
}
