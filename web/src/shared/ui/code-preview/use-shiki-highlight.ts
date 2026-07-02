/**
 * useShikiHighlight - 按代码字符串 shiki 高亮（非 URL）
 *
 * 与 code-preview 的 useCodeHighlight 区别：本 hook 接受内联代码字符串
 * （文章正文代码块），而非从 URL 拉取文件。复用 shiki codeToHtml，主题 github-dark，
 * 与 code-preview 视觉一致。
 *
 * 用 shiki/bundle/full：覆盖编辑器语言下拉的全部语言（含 web bundle 缺漏的
 * go/rust/dockerfile/nginx 等）。bundle/full 体积较大，故用动态 import 懒加载，
 * 仅在文章正文出现代码块时按需拉取，不进主包。
 */
import { useEffect, useState } from "react";

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
                // 动态加载 shiki full bundle（懒加载，不进主包）
                const { codeToHtml } = await import("shiki/bundle/full");
                const out = await codeToHtml(code, {
                    lang: language || "text",
                    theme: "github-dark",
                });
                if (!cancelled) {
                    setHtml(out);
                    setLoading(false);
                }
            } catch {
                // 高亮失败降级为纯文本（外层 pre 兜底）
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
