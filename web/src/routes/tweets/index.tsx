import type { TweetTimelineSort } from "@entities/tweet/model/types";
import { timelineOptions, tweetSidebarOptions } from "@features/tweets/api/queries";
import { TweetTimeline } from "@features/tweets/ui/TweetTimeline";
import { getForwardedCookie } from "@shared/server/cookies";
import { createFileRoute } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";
import { PageShell, Segmented, type SegmentedItem } from "@violet/ui";

const sortSegments: SegmentedItem<TweetTimelineSort>[] = [
	{ value: "latest", label: "最新" },
	{ value: "hot", label: "热门" },
	{ value: "images", label: "有图" },
];

interface TweetsSearch {
	sort?: Exclude<TweetTimelineSort, "latest">;
}

function validateTweetsSearch(search: Record<string, unknown>): TweetsSearch {
	return search.sort === "hot" || search.sort === "images" ? { sort: search.sort } : {};
}

const requestCookie = createServerOnlyFn(() => getForwardedCookie());

function TweetsPage() {
	const { sort = "latest" } = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<PageShell>
			<TweetTimeline
				sort={sort}
				header={
					<header className="flex flex-wrap items-end justify-between gap-4">
						<h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl">
							推文
						</h1>
						<Segmented
							aria-label="推文排序与筛选"
							rounded="full"
							value={sort}
							segments={sortSegments}
							onValueChange={(next) => {
								void navigate({
									search: next === "latest" ? {} : { sort: next },
									resetScroll: false,
								});
							}}
						/>
					</header>
				}
			/>
		</PageShell>
	);
}

export const Route = createFileRoute("/tweets/")({
	validateSearch: validateTweetsSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		// 客户端切换筛选时让已缓存的页面即时出现，未缓存的页在原位加载。
		if (typeof window !== "undefined") return;
		await Promise.all([
			context.queryClient.prefetchInfiniteQuery(
				timelineOptions(deps.sort, undefined, requestCookie()),
			),
			context.queryClient.prefetchQuery(tweetSidebarOptions()),
		]);
	},
	component: TweetsPage,
});
