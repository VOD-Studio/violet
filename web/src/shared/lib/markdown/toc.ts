/**
 * extractMarkdownToc - 从 markdown 源码提取 H2/H3/H4 目录
 *
 * 仅依赖项目内 Slugger + 正则，零重型依赖。刻意从 markdown barrel 中
 * 独立出来，避免 highlight.js / marked 等重依赖经此模块泄漏进文章详情页主 chunk。
 *
 * id 用项目统一 Slugger 生成，与 markdownToHtml / MarkdownContent 的
 * rehypeSlugHeadings 渲染出的标题 id 一致。
 */
import { Slugger } from "@shared/lib/slug";

export function extractMarkdownToc(
	md: string,
): Array<{ level: 2 | 3 | 4; text: string; id: string }> {
	const slugger = new Slugger();
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
