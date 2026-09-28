import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type { Tweet } from "../model/types";
import { tweetKeys } from "./keys";

/** 分享对话框与待发送预览打开时重新读取当前原文状态。 */
export const useSharedTweet = (id: string, enabled: boolean) =>
	useQuery({
		queryKey: tweetKeys.detail(id),
		queryFn: ({ signal }) => apiGet<Tweet>(`/tweets/${id}`, { signal }),
		enabled: enabled && !!id,
		staleTime: 0,
	});
