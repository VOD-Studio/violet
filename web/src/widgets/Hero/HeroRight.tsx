import { usePosts } from "@features/posts/api/queries";
import { ScrollArea } from "@shared/ui/scroll-area";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

/**
 * HeroRight - 右侧动态分发中心（spec Right 50%）
 *
 * 首屏右侧展示最新文章流（卡片列表），由首页网格分配宽度。
 * 点击进入详情触发 Morph。
 *
 * 数据走 usePosts（SSR 已预取），不动 api。
 */
const HeroRight = () => {
	const { data, isLoading } = usePosts({ page: 1, limit: 8 });

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="mb-3 flex shrink-0 items-center justify-between">
				<h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
					最新动态
				</h2>
			</div>
			<ScrollArea className="min-h-0 flex-1">
				<div className="flex flex-col gap-3 pr-2">
					{isLoading
						? Array.from({ length: 4 }).map((_, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: 骨架
								<ShimmerSkeleton key={`h-${i}`} className="h-24" />
							))
						: (data?.data ?? []).map((post) => (
								<SpotlightCard key={post.id} className="p-4">
									<Link to="/blog/$slug" params={{ slug: post.slug }} data-cursor="magnetic">
										<div className="mb-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
											<span>{post.author.username}</span>
											<span>·</span>
											<time>
												{formatDistanceToNow(new Date(post.published_at), {
													addSuffix: true,
													locale: zhCN,
												})}
											</time>
										</div>
										<h3 className="line-clamp-1 text-base font-semibold hover:text-neon-blue">
											{post.title}
										</h3>
										<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
											{post.excerpt}
										</p>
									</Link>
								</SpotlightCard>
							))}
				</div>
			</ScrollArea>
		</div>
	);
};

export default HeroRight;
