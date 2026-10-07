/** Markdown 与原生 HTML 标题按源码顺序共用 slug 去重，跳过代码中的标题示例。 */
import { extractToc } from "@shared/hooks/use-toc";

export function extractMarkdownToc(
	md: string,
): Array<{ level: 2 | 3 | 4; text: string; id: string }> {
	const lines = md.replace(/<(pre|code)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "").split("\n");
	const headings: string[] = [];
	let fence: { marker: string; length: number } | undefined;
	let htmlBlock = false;
	for (const line of lines) {
		const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
		if (fence) {
			if (
				fenceMatch &&
				fenceMatch[1][0] === fence.marker &&
				fenceMatch[1].length >= fence.length &&
				!fenceMatch[2].trim()
			) {
				fence = undefined;
			}
			continue;
		}
		// CommonMark 原生 HTML 块在空行后才重新启用 Markdown 标题。
		if (!line.trim()) htmlBlock = false;
		if (
			/^ {0,3}<\/?(?:details|summary|blockquote|div|p|section|h[1-6])(?:\s|>|\/)/i.test(line)
		) {
			htmlBlock = true;
		}
		if (!htmlBlock && fenceMatch) {
			fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length };
			continue;
		}
		const heading = !htmlBlock && /^(#{2,4})\s+(.+?)\s*$/.exec(line);
		if (heading) {
			const text = heading[2].replace(/[*_`~]/g, "").trim();
			if (text) headings.push(`<h${heading[1].length}>${text}</h${heading[1].length}>`);
		} else {
			headings.push(line);
		}
	}
	return extractToc(headings.join("\n"));
}

export type { TocItem } from "@shared/hooks/use-toc";
