import { apiGet } from "@shared/api/request";
import { queryOptions } from "@tanstack/react-query";
import { tweetKeys } from "./keys";

interface ContextAuthor {
	username: string;
	display_name: string;
	avatar_url: string;
}

interface TweetDetailContext {
	author: ContextAuthor & {
		bio: string;
		tweet_count: number;
		received_like_count: number;
	};
	quotes: {
		id: string;
		author: ContextAuthor;
		content: string;
		created_at: string;
	}[];
}

/** 发表、删除或点赞会改变多条同作者详情共享的累计数据。 */
export const tweetDetailContexts = [...tweetKeys.all, "detail-context"] as const;

export const tweetDetailContextOptions = (id: string) =>
	queryOptions({
		queryKey: [...tweetDetailContexts, id] as const,
		queryFn: ({ signal }) =>
			apiGet<TweetDetailContext>(`/tweets/${encodeURIComponent(id)}/context`, { signal }),
	});
