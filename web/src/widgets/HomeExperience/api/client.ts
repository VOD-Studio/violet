import { apiGet, apiGetPaged, apiPost } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";

import type {
	HomePublicationItem,
	PublicationQuery,
	PublicationWindow,
	SiteIdentity,
	SiteImpressionState,
} from "../types";

export function fetchSiteIdentity(): Promise<SiteIdentity> {
	return apiGet<SiteIdentity>("/site-identity");
}

export function fetchPublications(
	query: PublicationQuery,
): Promise<PagedResponse<HomePublicationItem>> {
	return apiGetPaged<HomePublicationItem>("/publications", { params: query });
}

/**
 * 续取完整发布时间窗口；服务端声明有下一页却未给游标时拒绝伪装成完整结果。
 *
 * @param publicationWindow - 最近十二个自然月的半开区间
 * @returns 服务端严格时间顺序下的全部窗口发布物
 */
export async function fetchPublicationWindow(
	publicationWindow: PublicationWindow,
): Promise<HomePublicationItem[]> {
	const publications: HomePublicationItem[] = [];
	const seenCursors = new Set<string>();
	let cursor: string | undefined;

	do {
		const page = await fetchPublications({ ...publicationWindow, cursor, limit: 100 });
		publications.push(...(page.data ?? []));
		if (!(page.pagination?.has_more ?? false)) break;
		const nextCursor = page.pagination?.next_cursor;
		if (!nextCursor || seenCursors.has(nextCursor)) {
			throw new Error("发布物分页未返回可继续的唯一游标");
		}
		seenCursors.add(nextCursor);
		cursor = nextCursor;
	} while (cursor);

	return publications;
}

export function fetchSiteImpression(): Promise<SiteImpressionState> {
	return apiGet<SiteImpressionState>("/site-impressions");
}

export function leaveSiteImpression(): Promise<SiteImpressionState> {
	return apiPost<SiteImpressionState>("/site-impressions");
}
