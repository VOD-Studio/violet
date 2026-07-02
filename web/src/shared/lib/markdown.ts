/**
 * markdown-to-html - Markdown 转 HTML（带 GFM + 标题锚点 id）
 *
 * 用于 PostEditor 提交时把 content_md 渲染为 content_html 存储，
 * 与详情页 TOC 的 github-slugger id 规则保持一致。
 */

import GithubSlugger from "github-slugger";
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

/**
 * extractMarkdownToc - 从 markdown 源码提取 H2/H3/H4 目录
 *
 * id 用 github-slugger 生成，与 markdownToHtml / rehype-slug 渲染出的标题 id 一致。
 */
export function extractMarkdownToc(
    md: string,
): Array<{ level: 2 | 3 | 4; text: string; id: string }> {
    const slugger = new GithubSlugger();
    const lines = md.split("\n");
    const out: Array<{ level: 2 | 3 | 4; text: string; id: string }> = [];
    for (const line of lines) {
        const m = /^(#{2,4})\s+(.+?)\s*$/.exec(line);
        if (!m) continue;
        const level = m[1].length as 2 | 3 | 4;
        const text = m[2].replace(/[*_`~]/g, "").trim();
        if (text) out.push({ level, text, id: slugger.slug(text) });
    }
    return out;
}

export type { TocItem } from "@shared/lib/hooks/use-toc";
