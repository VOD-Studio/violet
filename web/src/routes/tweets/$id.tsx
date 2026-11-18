import { tweetKeys } from "@features/tweets/api/keys";
import { fetchTweetDetail, useTweetDetail } from "@features/tweets/api/queries";
import { useRecordTweetView } from "@features/tweets/api/useRecordTweetView";
import { MAX_TWEET_IMAGES } from "@features/tweets/model/types";
import TweetCard from "@features/tweets/ui/TweetCard";
import TweetCommentSection from "@features/tweets/ui/TweetCommentSection";
import { TweetDetailMedia } from "@features/tweets/ui/TweetDetailMedia";
import { TweetDetailSources } from "@features/tweets/ui/TweetDetailSources";
import { SITE_URL } from "@shared/config/env";
import { HistoryBack } from "@shared/ui/history-back";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Empty, PageShell, ScrollArea, Skeleton } from "@violet/ui";
import { cn } from "cn";

const mobileViewportClass = "max-lg:overflow-visible! max-lg:overscroll-auto!";

/**
 * /tweets/$id - 单条推文详情页（公开）
 *
 * 匿名可访问。route loader 预取首屏（ensureQueryData），useTweetDetail 跟踪
 * 同一 queryKey 命中缓存。推文不存在/已删除 → 后端 404 → 友好兜底页。
 */
function TweetDetailPage() {
	const { id } = Route.useParams();
	const { image } = Route.useSearch();
	const initial = Route.useLoaderData();
	const navigate = useNavigate();
	const { data: tweet, isLoading, error } = useTweetDetail(id);

	// loader 已尝试预取：initial 非空直接用，loading 态仅初次未命中时出现
	const current = tweet ?? initial;
	useRecordTweetView(id, !!current && !error);

	if (isLoading && !current) {
		return (
			<PageShell>
				<div className="mx-auto w-full max-w-3xl">
					<Skeleton className="h-48 w-full rounded-xl" />
				</div>
			</PageShell>
		);
	}

	// 不存在 / 已删除：后端返回 404（作者删除后物理删，详情与列表均不可见）
	if (error || !current) {
		return (
			<PageShell>
				<Empty
					title="推文不存在"
					description="该推文可能已被删除或链接有误。"
					className="py-20"
				/>
			</PageShell>
		);
	}

	const hasImages = current.images.length > 0;
	const hasSources = !!(current.external_tweet || current.quoted_tweet || current.quote_of);
	const split = hasImages || hasSources;
	const discussion = (
		<div className="flex min-w-0 flex-col gap-6">
			<TweetCard
				tweet={current}
				variant="detail"
				detachMedia={split}
				onDeleted={() => navigate({ to: "/tweets" })}
			/>
			<div id="comments" className={cn("scroll-mt-24", split && "lg:scroll-mt-1")}>
				<TweetCommentSection tweetId={current.id} tweetAuthorId={current.author.id} />
			</div>
		</div>
	);

	return (
		<PageShell className={split ? "lg:flex lg:h-[calc(100dvh-4rem)] lg:flex-col" : undefined}>
			<div
				className={cn(
					"mx-auto flex w-full flex-col gap-6 font-reading",
					split ? "max-w-6xl lg:min-h-0 lg:flex-1" : "max-w-3xl",
				)}
			>
				<HistoryBack
					fallbackTo="/tweets"
					className="min-h-11 w-fit shrink-0 gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					返回时间线
				</HistoryBack>

				<div
					className={cn(
						"grid gap-6",
						split && "lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
					)}
				>
					{split && (
						<ScrollArea
							aria-label="推文媒体与来源"
							className="-m-1"
							viewportClassName={mobileViewportClass}
						>
							<div className="flex min-w-0 flex-col gap-4">
								<TweetDetailMedia
									key={`${id}:${image ?? 1}`}
									images={current.images}
									initialIndex={(image ?? 1) - 1}
								/>
								<TweetDetailSources tweet={current} />
							</div>
						</ScrollArea>
					)}
					{split ? (
						<ScrollArea
							aria-label="推文与评论"
							className="-m-1"
							viewportClassName={mobileViewportClass}
						>
							{discussion}
						</ScrollArea>
					) : (
						discussion
					)}
				</div>
			</div>
		</PageShell>
	);
}

export const Route = createFileRoute("/tweets/$id")({
	validateSearch: ({ image }: Record<string, unknown>): { image?: number } => {
		if (typeof image !== "number" || !Number.isInteger(image)) return {};
		return image > 1 && image <= MAX_TWEET_IMAGES ? { image } : {};
	},
	// 公开详情：loader 预取，404 时 ensureQueryData 抛错由组件兜底渲染
	loader: async ({ context, params }) => {
		try {
			return await context.queryClient.ensureQueryData({
				queryKey: tweetKeys.detail(params.id),
				queryFn: () => fetchTweetDetail(params.id),
			});
		} catch {
			// 推文不存在/已删除：返回 undefined，组件渲染 404 兜底
			return undefined;
		}
	},
	head: ({ loaderData }) => {
		const tweet = loaderData;
		if (!tweet) return { meta: [{ title: "推文不存在" }] };
		const source =
			tweet.external_tweet?.availability === "available"
				? tweet.external_tweet.snapshot
				: null;
		const quote = tweet.quoted_tweet;
		const quotedSource =
			quote?.external_tweet?.availability === "available"
				? quote.external_tweet.snapshot
				: null;
		const excerpt =
			tweet.content ||
			source?.text ||
			quote?.content ||
			quotedSource?.text ||
			`@${tweet.author.username} 的推文`;
		const image =
			tweet.images[0]?.url ||
			source?.media?.[0]?.url ||
			quote?.images[0]?.url ||
			quotedSource?.media?.[0]?.url;
		return {
			meta: [
				{ title: `${tweet.author.username} 的推文` },
				{ name: "description", content: excerpt.slice(0, 140) },
				{ property: "og:title", content: `${tweet.author.username} 的推文` },
				{ property: "og:description", content: excerpt.slice(0, 140) },
				...(image
					? [{ property: "og:image", content: new URL(image, SITE_URL).href }]
					: []),
			],
		};
	},
	component: TweetDetailPage,
});
