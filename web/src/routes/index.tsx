import { publishedGalleryKeys } from "@entities/gallery/api/keys";
import { fetchPublishedGalleries } from "@entities/gallery/api/queries";
import { publishedNoteKeys } from "@entities/note/api/keys";
import { fetchPublishedNotes } from "@entities/note/api/queries";
import { fetchArchiveYear, fetchArchiveYears } from "@features/archive/api/client";
import { archiveKeys } from "@features/archive/api/keys";
import { postKeys } from "@features/posts/api/keys";
import { fetchPosts } from "@features/posts/api/queries";
import { fetchSeries, seriesKeys } from "@features/series/api";
import { settingsKeys } from "@features/settings/api/keys";
import { fetchAnnouncements, fetchSettings } from "@features/settings/api/queries";
import { fetchTimeline } from "@features/tweets/api/queries";
import { SITE_URL } from "@shared/config/env";
import { createFileRoute } from "@tanstack/react-router";
import type { HomeSnapshot } from "@widgets/HomeExperience";
import HomeExperience, { HomeExperienceSkeleton } from "@widgets/HomeExperience";

const HOME_POST_LIMIT = 6;
const HOME_NOTE_LIMIT = 3;
const HOME_GALLERY_LIMIT = 2;
const HOME_SERIES_LIMIT = 2;
const HOME_TWEET_LIMIT = 3;

function HomePage() {
	const { snapshot } = Route.useLoaderData();
	return <HomeExperience snapshot={snapshot} />;
}
export const Route = createFileRoute("/")({
	pendingComponent: HomeExperienceSkeleton,
	pendingMs: 150,
	pendingMinMs: 200,
	loader: async ({ context }) => {
		const queryClient = context.queryClient;
		const settings = await queryClient
			.ensureQueryData({
				queryKey: settingsKeys.public(),
				queryFn: fetchSettings,
			})
			.catch(() => null);
		const postLimit = Math.min(settings?.posts_per_page ?? HOME_POST_LIMIT, HOME_POST_LIMIT);
		const postsQuery = { page: 1, limit: postLimit };
		const notesQuery = { limit: HOME_NOTE_LIMIT };
		const galleriesQuery = { limit: HOME_GALLERY_LIMIT };
		const seriesQuery = { page: 1, limit: HOME_SERIES_LIMIT };
		const archiveArticlesPromise =
			settings?.home_footprint_enabled === false
				? Promise.resolve([])
				: queryClient
						.ensureQueryData({
							queryKey: archiveKeys.years(),
							queryFn: fetchArchiveYears,
						})
						.then(async ({ years }) => {
							const archives = await Promise.all(
								years.slice(0, 2).map((year) =>
									queryClient
										.ensureQueryData({
											queryKey: archiveKeys.year(year),
											queryFn: () => fetchArchiveYear(year),
										})
										.catch(() => null),
								),
							);
							return archives.flatMap((archive) => archive?.items ?? []);
						})
						.catch(() => []);

		const [posts, notes, galleries, series, tweets, , archiveArticles] = await Promise.all([
			queryClient
				.ensureQueryData({
					queryKey: postKeys.list(postsQuery),
					queryFn: () => fetchPosts(postsQuery),
				})
				.catch(() => null),
			queryClient
				.ensureQueryData({
					queryKey: publishedNoteKeys.list(notesQuery),
					queryFn: () => fetchPublishedNotes(notesQuery),
				})
				.catch(() => null),
			queryClient
				.ensureQueryData({
					queryKey: publishedGalleryKeys.list(galleriesQuery),
					queryFn: () => fetchPublishedGalleries(galleriesQuery),
				})
				.catch(() => null),
			queryClient
				.ensureQueryData({
					queryKey: seriesKeys.list(seriesQuery),
					queryFn: () => fetchSeries(seriesQuery),
				})
				.catch(() => null),
			fetchTimeline({ limit: HOME_TWEET_LIMIT }).catch(() => null),
			queryClient
				.ensureQueryData({
					queryKey: settingsKeys.announcements(),
					queryFn: fetchAnnouncements,
				})
				.catch(() => null),
			archiveArticlesPromise,
		]);

		const snapshot: HomeSnapshot = {
			settings,
			posts: posts?.data ?? [],
			archiveArticles,
			postTotal: posts?.pagination.total ?? posts?.data.length ?? 0,
			notes: notes?.data ?? [],
			galleries: galleries?.data ?? [],
			series: series?.data ?? [],
			tweets: tweets?.data ?? [],
		};
		return { snapshot };
	},
	head: () => ({
		meta: [
			{ title: "Violet — 个人创作与读者社区" },
			{
				name: "description",
				content: "文章、系列、笔记、图集与推文组成的个人创作和读者社区。",
			},
		],
		links: [{ rel: "canonical", href: SITE_URL }],
	}),
	component: HomePage,
});
