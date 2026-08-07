import { fetchTweetDetail, useTweetDetail } from "@features/tweets/api/queries";
import { tweetKeys } from "@features/tweets/api/keys";
import TweetCard from "@features/tweets/ui/TweetCard";
import Empty from "@shared/ui/empty";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/**
 * /tweets/$id - 单条推文详情页（公开）
 *
 * 匿名可访问。route loader 预取首屏（ensureQueryData），useTweetDetail 跟踪
 * 同一 queryKey 命中缓存。推文不存在/已删除 → 后端 404 → 友好兜底页。
 *
 * 结构上预留 P2 评论区、P3 转发链接落点（TweetCard 之下追加区域）。
 */
function TweetDetailPage() {
	const { id } = Route.useParams();
	const initial = Route.useLoaderData();
	const navigate = useNavigate();
	const { data: tweet, isLoading, error } = useTweetDetail(id);

	// loader 已尝试预取：initial 非空直接用，loading 态仅初次未命中时出现
	const current = tweet ?? initial;

	if (isLoading && !current) {
		return (
			<div className="mx-auto w-full max-w-2xl">
				<ShimmerSkeleton className="h-48 w-full rounded-xl" />
			</div>
		);
	}

	// 不存在 / 已删除：后端返回 404（作者删除后物理删，详情与列表均不可见）
	if (error || !current) {
		return (
			<Empty
				title="推文不存在"
				description="该推文可能已被删除或链接有误。"
				className="py-20"
			/>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
			<button
				type="button"
				onClick={() => navigate({ to: "/tweets" })}
				className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			>
				<ArrowLeft className="size-3.5" />
				返回时间线
			</button>

			<TweetCard
				tweet={current}
				variant="detail"
				// 删除成功后缓存已自动联动，详情页导航回时间线
				onDeleted={() => navigate({ to: "/tweets" })}
			/>
		</div>
	);
}

export const Route = createFileRoute("/tweets/$id")({
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
		const excerpt = tweet.content || `@${tweet.author.username} 的推文`;
		return {
			meta: [
				{ title: `${tweet.author.username} 的推文` },
				{ name: "description", content: excerpt.slice(0, 140) },
				{ property: "og:title", content: `${tweet.author.username} 的推文` },
				{ property: "og:description", content: excerpt.slice(0, 140) },
				...(tweet.images[0] ? [{ property: "og:image", content: tweet.images[0] }] : []),
			],
		};
	},
	component: TweetDetailPage,
});
