import type { ArchiveItem } from "@features/archive/model/types";
import { noteTitle } from "@features/note-browse/model/display";

import type { HomePublicationItem, HomePublicationKind, HomeSnapshot } from "./types";

export const HOME_KIND_LABEL: Record<HomePublicationKind, string> = {
	article: "文章",
	note: "笔记",
	gallery: "图集",
	series: "系列",
};

/** 将公开内容按发布时间组织成首页目录，精选文章只影响首屏选择，不改变时间顺序。 */
export function buildHomePublications(snapshot: HomeSnapshot): HomePublicationItem[] {
	const articles: HomePublicationItem[] = snapshot.posts.map((post) => ({
		key: `article-${post.id}`,
		kind: "article",
		routeKey: post.slug,
		title: post.title,
		publishedAt: post.published_at,
		isFeatured: post.is_featured,
	}));
	const notes: HomePublicationItem[] = snapshot.notes.map((note) => ({
		key: `note-${note.id}`,
		kind: "note",
		routeKey: note.id,
		title: noteTitle(note),
		publishedAt: note.published_at,
		isFeatured: false,
	}));
	const galleries: HomePublicationItem[] = snapshot.galleries.map((gallery) => ({
		key: `gallery-${gallery.id}`,
		kind: "gallery",
		routeKey: gallery.slug,
		title: gallery.title,
		publishedAt: gallery.published_at,
		isFeatured: false,
	}));
	const series: HomePublicationItem[] = snapshot.series.map((item) => ({
		key: `series-${item.id}`,
		kind: "series",
		routeKey: item.slug,
		title: item.title,
		publishedAt: item.latest_chapter_at || item.created_at,
		isFeatured: false,
	}));

	return [...articles, ...notes, ...galleries, ...series].sort(
		(a, b) => timestamp(b.publishedAt) - timestamp(a.publishedAt),
	);
}

/** 用轻量归档文章补全足迹历史，同时保留其他公开内容类型。 */
export function buildHomeAccumulationPublications(
	publications: HomePublicationItem[],
	archiveArticles: ArchiveItem[],
): HomePublicationItem[] {
	const articles =
		archiveArticles.length > 0
			? archiveArticles.map<HomePublicationItem>((article) => ({
					key: `article-${article.id}`,
					kind: "article",
					routeKey: article.slug,
					title: article.title,
					publishedAt: article.published_at,
					isFeatured: false,
				}))
			: publications.filter((item) => item.kind === "article");
	const nonArticles = publications.filter((item) => item.kind !== "article");

	return [...articles, ...nonArticles].sort(
		(left, right) => timestamp(right.publishedAt) - timestamp(left.publishedAt),
	);
}

/** 精选文章优先成为当期主内容；没有精选时使用最新发布。 */
export function selectHomeLead(items: HomePublicationItem[]): HomePublicationItem | null {
	return items.find((item) => item.kind === "article" && item.isFeatured) ?? items[0] ?? null;
}

export function formatHomeDate(value: string): string {
	const date = value.slice(0, 10);
	return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.replaceAll("-", ".") : value;
}

function timestamp(value: string): number {
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
}
