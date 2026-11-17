import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type { ExternalTweet } from "../model/types";

/** 只读共享原文查询，不创建时间线推文或发布凭证。 */
export const useExternalTweet = (sourceID: string) =>
	useQuery({
		queryKey: ["external-tweets", sourceID],
		queryFn: ({ signal }) =>
			apiGet<ExternalTweet>("/tweets/external/resolve", {
				params: { url: `https://x.com/i/status/${sourceID}` },
				signal,
				timeout: 35_000,
			}),
		staleTime: 60_000,
		retry: false,
		enabled: typeof window !== "undefined",
	});
