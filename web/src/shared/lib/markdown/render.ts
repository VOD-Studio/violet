/**
 * markdownToHtml - Markdown 转 HTML（带 GFM + 标题锚点 id + 代码高亮）
 *
 * 依赖较重（marked + highlight.js + marked-gfm-heading-id + marked-highlight），
 * 刻意独立成模块，避免经 markdown barrel 泄漏进文章详情页等只需 TOC 的页面。
 *
 * 用于 PostEditor 提交时把 content_md 渲染为 content_html 存储，
 * 与详情页 TOC 的 github-slugger id 规则保持一致。
 */
import hljs from "highlight.js";
import { marked } from "marked";
import { gfmHeadingId } from "marked-gfm-heading-id";
import { markedHighlight } from "marked-highlight";

// 启用 GFM（表格/删除线/任务列表）+ 标题 id（github-slugger 规则）+ 代码高亮
marked.use(
    gfmHeadingId(),
    markedHighlight({
        langPrefix: "hljs language-",
        highlight(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : "plaintext";
            try {
                return hljs.highlight(code, { language }).value;
            } catch {
                return code;
            }
        },
    }),
);

/**
 * markdownToHtml - markdown 字符串转 HTML
 *
 * 标题自动带 id（gfm-heading-id，github-slugger 规则），
 * 与详情页 TOC（extractMarkdownToc 用同一 slugger）锚点一致。
 */
export function markdownToHtml(md: string): string {
    return marked.parse(md, { async: false }) as string;
}
