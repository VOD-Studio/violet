import { publishedNoteKeys } from "@entities/note/api/keys";
import { fetchPublishedNotes } from "@entities/note/api/queries";
import type { PublicNote } from "@entities/note/model/types";
import { noteTitle } from "@features/note-browse/model/display";
import { postKeys } from "@features/posts/api/keys";
import { fetchPosts } from "@features/posts/api/queries";
import type { Post } from "@features/posts/model/types";
import type { ProfileLatest } from "@shared/ui/site-profile";
import { useQuery } from "@tanstack/react-query";

/** 卡片里的日期：本地时区的月.日。 */
function monthDay(iso: string): string {
	const date = new Date(iso);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

/**
 * 将本页发布时间最新的文章转为站长卡片条目。
 *
 * @remarks 公开列表精选优先，不能直接取第一项作为最新文章。
 * @returns 带本地时区月日和详情链接的条目；本页无文章时为 undefined。
 */
export function latestPost(
	posts: Pick<Post, "title" | "slug" | "published_at">[] | undefined,
): ProfileLatest | undefined {
	const newest = posts?.reduce<(typeof posts)[number] | undefined>(
		(best, current) =>
			!best || Date.parse(current.published_at) > Date.parse(best.published_at)
				? current
				: best,
		undefined,
	);
	if (!newest) return undefined;
	return {
		title: newest.title,
		date: monthDay(newest.published_at),
		href: `/blog/${newest.slug}`,
	};
}

/**
 * 将手记转为站长卡片条目。
 *
 * @returns 带本地时区月日和详情链接的条目；未传入手记时为 undefined。
 */
export function latestNote(
	note: Pick<PublicNote, "id" | "title" | "content_html" | "published_at"> | undefined,
): ProfileLatest | undefined {
	if (!note) return undefined;
	return {
		title: noteTitle(note),
		date: monthDay(note.published_at),
		href: `/notes/${note.id}`,
	};
}

/** 卡片数据一次性取回即可，之后切换页面不必反复请求。 */
const FRESH_MS = 5 * 60_000;
/** 文章列表精选优先，多取一页才能在里面挑出最新发布的一篇。 */
const POST_PAGE_SIZE = 10;

/**
 * 站长卡片里的最新文章与最新手记，各一条。
 *
 * @param enabled - 用户表现出要看卡片（悬停、聚焦或点开）后才请求，平时不占页面加载
 * @returns `pending` 按条标记仍在首次加载的一边；某一边失败或为空时只缺那一条
 */
export function useProfileLatest(enabled: boolean): {
	latest: { post?: ProfileLatest; note?: ProfileLatest };
	pending: { post: boolean; note: boolean };
} {
	const posts = useQuery({
		queryKey: postKeys.list({ limit: POST_PAGE_SIZE }),
		queryFn: () => fetchPosts({ limit: POST_PAGE_SIZE }),
		enabled,
		staleTime: FRESH_MS,
		refetchOnWindowFocus: false,
	});
	const notes = useQuery({
		queryKey: publishedNoteKeys.list({ limit: 1 }),
		queryFn: () => fetchPublishedNotes({ limit: 1 }),
		enabled,
		staleTime: FRESH_MS,
		refetchOnWindowFocus: false,
	});
	return {
		latest: { post: latestPost(posts.data?.data), note: latestNote(notes.data?.data[0]) },
		pending: { post: posts.isLoading, note: notes.isLoading },
	};
}
