/**
 * extractMarkdownToc - 从 markdown 源码提取 H2/H3/H4 目录
 *
 * 仅依赖 github-slugger + 正则，零重型依赖。刻意从 markdown barrel 中
 * 独立出来，避免 highlight.js / marked 等重依赖经此模块泄漏进文章详情页主 chunk。
 *
 * id 用 github-slugger 生成，与 markdownToHtml / rehype-slug 渲染出的标题 id 一致。
 */
import GithubSlugger from "github-slugger";

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
