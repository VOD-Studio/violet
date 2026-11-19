import { type JournalFilters, NOTE_TYPES } from "@entities/note/model/types";
import { SITE_URL } from "@shared/config/env";
import { redirect } from "@tanstack/react-router";

/** 手记列表在地址栏支持的筛选组合，不含分页游标。 */
export type JournalSearch = JournalFilters;

const PROJECT_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** 解析手记的可分享筛选条件。 */
export function parseJournalSearch(search: Record<string, unknown>): JournalSearch {
	const type =
		search.type === "progress" ? "progress" : NOTE_TYPES.find((type) => type === search.type);
	return {
		tag:
			type !== "progress" && typeof search.tag === "string"
				? search.tag.trim() || undefined
				: undefined,
		type,
		project_id:
			typeof search.project_id === "string" && PROJECT_ID.test(search.project_id)
				? search.project_id.toLowerCase()
				: undefined,
	};
}

/** 详情的公开地址，用于可分享链接与 SEO。 */
export function journalNoteUrl(id: string): string {
	return `${SITE_URL.replace(/\/+$/, "")}/journal/${encodeURIComponent(id)}`;
}

/** 只迁移旧路径；搜索字面量、重复参数与片段不经 Router 编解码。 */
export function legacyNotesRedirect(href: string, id?: string) {
	const suffixStart = href.search(/[?#]/);
	const suffix = suffixStart === -1 ? "" : href.slice(suffixStart);
	const path = id === undefined ? "/journal" : `/journal/${encodeURIComponent(id)}`;
	return redirect({ href: `${path}${suffix}`, statusCode: 301, reloadDocument: true });
}
