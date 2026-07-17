/**
 * useShikiHighlight - 按代码字符串 shiki 高亮（非 URL）
 *
 * 与 code-preview 的 useCodeHighlight 区别：本 hook 接受内联代码字符串
 * （文章正文代码块），而非从 URL 拉取文件。复用共享 highlighter 单例（lib/highlighter），
 * 主题 github-dark，与 code-preview 视觉一致。
 *
 * 语言按白名单按需加载（shiki core + loadLanguage），不在白名单内的语言降级为纯文本。
 * bundle/full 不再进入构建产物。
 */
import { useEffect, useState } from "react";
import { highlightCode } from "./lib/highlighter";

export interface UseShikiHighlightResult {
    /** 高亮后的 HTML（shiki 输出 <pre class="shiki">），未完成时为空 */
    html: string;
    /** 是否正在高亮 */
    loading: boolean;
}

/**
 * @param code 原始代码字符串
 * @param language shiki 语言 ID（如 typescript / go / bash），未知传 "text"
 */
export function useShikiHighlight(code: string, language: string): UseShikiHighlightResult {
    const [html, setHtml] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        void (async () => {
            try {
                const out = await highlightCode(code, language);
                if (!cancelled) {
                    setHtml(out);
                    setLoading(false);
                }
            } catch {
                // 高亮失败降级为空（外层 pre 兜底）
                if (!cancelled) {
                    setHtml("");
                    setLoading(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [code, language]);

    return { html, loading };
}
