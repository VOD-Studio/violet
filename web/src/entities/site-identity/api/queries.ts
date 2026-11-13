import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchSiteIdentity } from "./client";

export function siteIdentityQueryOptions() {
	return queryOptions({
		queryKey: ["site-identity"],
		queryFn: fetchSiteIdentity,
		staleTime: 60_000,
	});
}

export function useSiteIdentity() {
	return useQuery(siteIdentityQueryOptions());
}
