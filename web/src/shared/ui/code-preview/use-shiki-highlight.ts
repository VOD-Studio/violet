/**
 * useShikiHighlight - 按代码字符串 shiki 高亮（非 URL）
 *
 * 与 code-preview 的 useCodeHighlight 区别：本 hook 接受内联代码字符串
 * （文章正文代码块），而非从 URL 拉取文件。复用 shiki/bundle/web 的 codeToHtml，
 * 主题 github-dark，与 code-preview 视觉一致。
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
        // 动态加载 shiki web bundle（仅含 web/通用语言，体积优化）
        import("shiki/bundle/web")
            .then(({ codeToHtml }) =>
                codeToHtml(code, { lang: language || "text", theme: "github-dark" }),
            )
            .then((out) => {
                if (!cancelled) {
                    setHtml(out);
                    setLoading(false);
                }
            })
            .catch(() => {
                // 高亮失败降级为纯文本（外层 pre 兜底）
                if (!cancelled) {
                    setHtml("");
                    setLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [code, language]);

    return { html, loading };
}
