import { Slugger } from "@shared/lib/slug";
import source from "../../../../packages/kanban/docs/api.md?raw";

/** 包内文档的相对链接在站点里打不开，改指向仓库里的同一个文件。 */
const REPOSITORY = "https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/kanban";

/**
 * 包的 API 文档正文：去掉一级标题（页面自己有），相对链接改成仓库地址。
 *
 * @param markdown - `docs/api.md` 原文
 */
export function toSiteApiDoc(markdown: string): string {
	return markdown
		.replace(/^# .*\n+/u, "")
		.replace(/\]\(\.\.\/([^)]+)\)/gu, `](${REPOSITORY}/$1)`)
		.replace(/\]\(\.\/([^)]+)\)/gu, `](${REPOSITORY}/docs/$1)`);
}

export const KANBAN_API_DOC = toSiteApiDoc(source);

/** API 目录里的一项。 */
export interface ApiDocSection {
	/** 页面里标题的 id，与 MarkdownContent 生成的一致 */
	id: string;
	title: string;
}

/**
 * API 正文的二级标题，供目录跳转。
 *
 * 所有级别的标题按顺序共用一个 Slugger，与渲染管线一样处理重名，算出的 id 才对得上。
 */
export function apiDocOutline(markdown: string): ApiDocSection[] {
	const slugger = new Slugger();
	const outline: ApiDocSection[] = [];
	for (const [, hashes, text] of markdown.matchAll(/^(#{1,6}) (.+)$/gmu)) {
		const title = text.replaceAll("`", "").trim();
		const id = slugger.slug(title);
		if (hashes.length === 2) outline.push({ id, title });
	}
	return outline;
}

export const KANBAN_API_OUTLINE = apiDocOutline(KANBAN_API_DOC);
