import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse, PageQuery } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import type { ChapterContext, SeriesDetail, SeriesSummary } from "../model/types";
import { seriesKeys } from "./keys";

export const fetchSeries = async (query: PageQuery = {}): Promise<PagedResponse<SeriesSummary>> =>
	apiGetPaged<SeriesSummary>("/series", { params: query });

export const useSeries = (query: PageQuery = {}) =>
	useQuery({
		queryKey: seriesKeys.list(query),
		queryFn: () => fetchSeries(query),
	});

export const fetchSeriesBySlug = async (slug: string): Promise<SeriesDetail> =>
	apiGet<SeriesDetail>(`/series/${slug}`);

export const useSeriesDetail = (slug: string) =>
	useQuery({
		queryKey: seriesKeys.detail(slug),
		queryFn: () => fetchSeriesBySlug(slug),
		enabled: slug.length > 0,
	});

export const fetchChapterContext = async (postSlug: string): Promise<ChapterContext | null> =>
	apiGet<ChapterContext | null>(`/series/context/${postSlug}`);

export const useChapterContext = (postSlug: string) =>
	useQuery({
		queryKey: seriesKeys.context(postSlug),
		queryFn: () => fetchChapterContext(postSlug),
		enabled: postSlug.length > 0,
	});
