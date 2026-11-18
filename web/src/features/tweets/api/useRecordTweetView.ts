import { authKeys } from "@features/auth/api/keys";
import { fetchCsrfToken } from "@features/auth/api/queries";
import { getCSRFToken } from "@shared/api/csrf";
import { apiPost } from "@shared/api/request";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { updateCachedTweet } from "./timeline-cache";

/** 详情实际挂载后记一次浏览；预取和 SSR 不写入。 */
export function useRecordTweetView(id: string, enabled: boolean) {
	const qc = useQueryClient();
	const lastViewed = useRef<string>(null);

	useEffect(() => {
		if (!enabled || !id || lastViewed.current === id) return;
		lastViewed.current = id;
		async function recordView() {
			if (!getCSRFToken()) {
				await qc.fetchQuery({
					queryKey: authKeys.csrfToken(),
					queryFn: fetchCsrfToken,
					staleTime: 0,
				});
			}
			const { view_count } = await apiPost<{ view_count: number }>(`/tweets/${id}/views`);
			updateCachedTweet(qc, id, (tweet) =>
				view_count > tweet.view_count ? { ...tweet, view_count } : tweet,
			);
		}
		// 浏览记录失败不影响阅读正文。
		void recordView().catch(() => {});
	}, [enabled, id, qc]);
}
