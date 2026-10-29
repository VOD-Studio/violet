import { normalizeLinkUrl } from "@shared/lib/linkify";
import { queryOptions, useQueries } from "@tanstack/react-query";
import type { LinkPreviewCard, LinkPreviewState } from "../model/types";
import { lookupLinkPreview } from "./lookup";

/** URL 级共享缓存；只轮询明确 pending 的链接，完成、失败或卸载后停止。 */
export function useLinkPreviews(urls: string[], snapshots: LinkPreviewCard[] = []) {
	const normalized = [...new Set(urls.map(normalizeLinkUrl).filter(Boolean))];
	const initial = new Map(snapshots.map((card) => [normalizeLinkUrl(card.url), card]));
	const queries = useQueries({
		queries: normalized.map((url) =>
			queryOptions({
				queryKey: ["link-previews", url],
				queryFn: () => lookupLinkPreview(url),
				enabled: typeof window !== "undefined",
				initialData: initial.has(url)
					? { url, card: initial.get(url) ?? null, pending: false }
					: undefined,
				initialDataUpdatedAt: 0,
				staleTime: 60_000,
				retry: false,
				refetchInterval: (query) =>
					query.state.status !== "error" && query.state.data?.pending ? 2_000 : false,
			}),
		),
	});
	return normalized.map(
		(url, index): LinkPreviewState => ({
			url,
			card: queries[index].data?.card ?? initial.get(url) ?? null,
			pending:
				!queries[index].isError &&
				(queries[index].data?.pending ?? queries[index].isFetching),
		}),
	);
}
