import { fetchArchiveYear, fetchArchiveYears } from "@features/archive/api/client";
import { archiveKeys } from "@features/archive/api/keys";
import { postKeys } from "@features/posts/api/keys";
import { fetchPosts, fetchPostTags } from "@features/posts/api/queries";
import { fetchSeries, seriesKeys } from "@features/series/api";
import { settingsKeys } from "@features/settings/api/keys";
import { fetchSettings } from "@features/settings/api/queries";
import type { QueryClient } from "@tanstack/react-query";
import { BLOG_SERIES_PAGE_SIZE, type BlogSearch, type BlogView } from "./search";

/** 预取当前视图与筛选项；非当前视图不拉列表，归档仅预取最近年。 */
export async function loadBlog(queryClient: QueryClient, view: BlogView, search: BlogSearch) {
	const tags = queryClient.prefetchQuery({
		queryKey: postKeys.tags({ source: search.source }),
		queryFn: () => fetchPostTags({ source: search.source }),
	});
	const settings = await queryClient
		.ensureQueryData({
			queryKey: settingsKeys.public(),
			queryFn: fetchSettings,
		})
		.catch(() => undefined);
	const configuredLimit = settings?.posts_per_page ?? 12;
	const limit = Math.min(50, Math.max(1, configuredLimit));
	const filter = { tag: search.tag, source: search.source };

	if (view === "archive") {
		const index = await queryClient
			.ensureQueryData({
				queryKey: archiveKeys.years(filter),
				queryFn: () => fetchArchiveYears(filter),
			})
			.catch(() => undefined);
		const latest = index?.years?.[0];
		if (latest !== undefined) {
			await queryClient.prefetchQuery({
				queryKey: archiveKeys.year(latest, filter),
				queryFn: () => fetchArchiveYear(latest, filter),
			});
		}
	} else if (view === "series") {
		const query = { ...filter, page: search.page ?? 1, limit: BLOG_SERIES_PAGE_SIZE };
		await queryClient.prefetchQuery({
			queryKey: seriesKeys.list(query),
			queryFn: () => fetchSeries(query),
		});
	} else {
		const query = { ...filter, page: search.page ?? 1, limit };
		await queryClient.prefetchQuery({
			queryKey: postKeys.list(query),
			queryFn: () => fetchPosts(query),
		});
	}
	await tags;
	return { limit, search };
}
