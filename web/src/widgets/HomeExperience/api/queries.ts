import { queryOptions, useQuery } from "@tanstack/react-query";

import { recentTwelveMonthWindow } from "../home-accumulation-model";
import type { PublicationWindow } from "../types";
import {
	fetchPublications,
	fetchPublicationWindow,
	fetchSiteIdentity,
	fetchSiteImpression,
} from "./client";
import { homeResourceKeys } from "./keys";

export function siteIdentityQueryOptions() {
	return queryOptions({
		queryKey: homeResourceKeys.siteIdentity(),
		queryFn: fetchSiteIdentity,
		staleTime: 60_000,
	});
}

export function recentPublicationsQueryOptions() {
	const query = { limit: 5 } as const;
	return queryOptions({
		queryKey: homeResourceKeys.publications(query),
		queryFn: () => fetchPublications(query),
		staleTime: 30_000,
	});
}

export function footprintPublicationsQueryOptions(window: PublicationWindow) {
	return queryOptions({
		queryKey: homeResourceKeys.publicationWindow(window),
		queryFn: () => fetchPublicationWindow(window),
		staleTime: 30_000,
	});
}

export function siteImpressionQueryOptions() {
	return queryOptions({
		queryKey: homeResourceKeys.siteImpression(),
		queryFn: fetchSiteImpression,
		staleTime: 0,
	});
}

export function useSiteIdentity() {
	return useQuery(siteIdentityQueryOptions());
}

export function useRecentPublications() {
	return useQuery(recentPublicationsQueryOptions());
}

export function useFootprintPublications(enabled: boolean) {
	const publicationWindow = recentTwelveMonthWindow();
	return useQuery({
		...footprintPublicationsQueryOptions(publicationWindow),
		enabled: enabled && typeof document !== "undefined",
	});
}

export function useSiteImpression() {
	return useQuery({
		...siteImpressionQueryOptions(),
		enabled: typeof document !== "undefined",
	});
}
