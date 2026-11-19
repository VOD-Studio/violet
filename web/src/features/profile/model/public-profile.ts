import type { UserProfile } from "@entities/user/model/types";

export const PROFILE_TABS = ["all", "posts", "tweets", "comments", "annotations"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

/** 公开主页只使用公开投影，常读主题由本人主动填写。 */
export interface PublicProfile extends UserProfile {
	location: string;
	website: string;
	public_reading_preferences: string[];
	stats: {
		posts: number;
		tweets: number;
		comments: number;
		annotations: number;
		received_likes: number;
		received_reactions: number;
	};
	activity: {
		timezone: string;
		start_date: string;
		end_date: string;
		total: number;
		days: { date: string; count: number }[];
	};
}

/** 每项持有真实来源链接，时间和类型来自同一服务端游标投影。 */
export interface PublicActivity {
	id: string;
	type: "post" | "tweet" | "comment" | "annotation" | "tweet_comment";
	title: string;
	body: string;
	selected_text: string;
	url: string;
	cover_image: string;
	images: { url: string; width: number | null; height: number | null }[];
	created_at: string;
}

/** URL 分类与游标直接参与 SSR 查询；切换分类时清除旧游标。 */
export function parseProfileSearch(search: Record<string, unknown>): {
	tab?: ProfileTab;
	cursor?: string;
} {
	return {
		tab:
			PROFILE_TABS.includes(search.tab as ProfileTab) && search.tab !== "all"
				? (search.tab as ProfileTab)
				: undefined,
		cursor:
			typeof search.cursor === "string" && search.cursor.length <= 1500
				? search.cursor
				: undefined,
	};
}
