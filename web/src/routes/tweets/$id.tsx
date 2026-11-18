import { useMe } from "@features/auth/api/queries";
import { tweetDetailContextOptions } from "@features/tweets/api/detail-context";
import { tweetKeys } from "@features/tweets/api/keys";
import { fetchTweetDetail, useTweetDetail } from "@features/tweets/api/queries";
import { useRecordTweetView } from "@features/tweets/api/useRecordTweetView";
import { MAX_TWEET_IMAGES } from "@features/tweets/model/types";
import TweetCard from "@features/tweets/ui/TweetCard";
import TweetCommentSection from "@features/tweets/ui/TweetCommentSection";
import { TweetDetailRail } from "@features/tweets/ui/TweetDetailRail";
import { ApiError } from "@shared/api/error";
import { SITE_URL } from "@shared/config/env";
import { getForwardedCookie } from "@shared/server/cookies";
import { HistoryBack } from "@shared/ui/history-back";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";
import { Button, Empty, PageShell, ScrollArea, Skeleton } from "@violet/ui";
import { useEffect, useRef } from "react";

const mobileViewportClass = "max-lg:overflow-visible! max-lg:overscroll-auto!";
const requestCookie = createServerOnlyFn(() => getForwardedCookie());

// 详情 GET 的唯一输入是 ID；非法 ID 不指向有效的详情页。
const isMissingTweet = (error: unknown) =>
	error instanceof ApiError && (error.status === 404 || error.status === 400);

function TweetDetailPending() {
	return (
		<PageShell>
			<div role="status" aria-label="正在加载推文" className="mx-auto w-full max-w-280">
				<Skeleton className="h-48 w-full rounded-xl" />
			</div>
		</PageShell>
	);
}

function TweetDetailNotFound() {
	return (
		<PageShell>
			<Empty
				title="推文不存在"
				description="该推文可能已被删除或链接有误。"
				action={
					<Button asChild variant="outline">
						<Link to="/tweets">返回时间线</Link>
					</Button>
				}
			/>
		</PageShell>
	);
}

function TweetDetailError() {
	const router = useRouter();
	return (
		<PageShell>
			<Empty
				title="推文暂时加载失败"
				description="重试不会离开当前地址。"
				action={<Button onClick={() => void router.invalidate()}>重试</Button>}
			/>
		</PageShell>
	);
}

function TweetDetailPage() {
	const { id } = Route.useParams();
	const { image } = Route.useSearch();
	const initial = Route.useLoaderData();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const viewerId = useMe().data?.id;
	const previousViewerId = useRef(viewerId);
	const { data: tweet, isLoading, error } = useTweetDetail(id);
	const current = tweet ?? initial;
	useRecordTweetView(id, !!current && !error);

	useEffect(() => {
		if (previousViewerId.current === viewerId) return;
		previousViewerId.current = viewerId;
		void queryClient.invalidateQueries({ queryKey: tweetKeys.details });
		void queryClient.resetQueries({ queryKey: tweetKeys.commentReactionRoot });
	}, [queryClient, viewerId]);

	if (isMissingTweet(error)) throw notFound();
	if (isLoading && !current) return <TweetDetailPending />;
	if (!current) throw error ?? notFound();

	return (
		<PageShell className="lg:flex lg:h-[calc(100dvh-4rem)] lg:flex-col">
			<div className="mx-auto flex w-full max-w-280 flex-col gap-4 font-reading lg:min-h-0 lg:flex-1">
				<HistoryBack
					fallbackTo="/tweets"
					className="min-h-11 w-fit shrink-0 gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					返回时间线
				</HistoryBack>

				<div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)] lg:gap-12 xl:gap-18">
					<ScrollArea
						key={id}
						aria-label="推文与评论"
						className="-m-1"
						viewportClassName={mobileViewportClass}
					>
						<div className="flex min-w-0 flex-col gap-4">
							<TweetCard
								tweet={current}
								variant="detail"
								initialImageIndex={image === undefined ? undefined : image - 1}
								onDeleted={() => void navigate({ to: "/tweets" })}
							/>
							<TweetCommentSection
								tweetId={current.id}
								tweetAuthorId={current.author.id}
								commentCount={current.comment_count}
							/>
						</div>
					</ScrollArea>
					<ScrollArea
						key={`${id}:rail`}
						aria-label="作者与引用"
						className="-m-1"
						viewportClassName={mobileViewportClass}
					>
						<TweetDetailRail tweetId={current.id} quoteCount={current.quote_count} />
					</ScrollArea>
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
	loader: async ({ context, params }) => {
		const { queryClient } = context;
		const rail = tweetDetailContextOptions(params.id);
		const cookie = typeof window === "undefined" ? requestCookie() : undefined;
		try {
			// 服务端与水合首帧必须看到同一份侧栏快照。
			const [tweet] = await Promise.all([
				queryClient.fetchQuery({
					queryKey: tweetKeys.detail(params.id),
					queryFn: () => fetchTweetDetail(params.id, cookie),
				}),
				queryClient.ensureQueryData({ ...rail, retry: false }).catch(() => {
					queryClient.removeQueries({ queryKey: rail.queryKey, exact: true });
				}),
			]);
			return tweet;
		} catch (error) {
			if (isMissingTweet(error)) throw notFound();
			throw error;
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
	pendingComponent: TweetDetailPending,
	notFoundComponent: TweetDetailNotFound,
	errorComponent: TweetDetailError,
});
