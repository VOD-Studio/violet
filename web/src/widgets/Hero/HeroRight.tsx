import { usePosts } from "@features/posts/api/queries";
import { ScrollArea } from "@shared/ui/scroll-area";
import { Skeleton } from "@shared/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

/**
 * HeroRight - 右侧最新文章流（柔和阅读风）
 *
 * 简洁卡片列表：作者 · 时间 / 标题 / 摘要。
 * 无聚光灯、无磁吸 —— 干净可读。
 * 数据走 usePosts（SSR 已预取），不动 api。
 */
const HeroRight = () => {
	const { data, isLoading } = usePosts({ page: 1, limit: 8 });

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="mb-3 flex shrink-0 items-center justify-between">
				<h2 className="text-sm font-medium text-muted-foreground">最新动态</h2>
			</div>
			<ScrollArea className="min-h-0 flex-1">
				<div className="flex flex-col gap-2 pr-2">
					{isLoading
						? Array.from({ length: 4 }).map((_, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: 骨架
								<Skeleton key={`h-${i}`} className="h-20" />
							))
						: (data?.data ?? []).map((post) => (
								<Link
									key={post.id}
									to="/blog/$slug"
									params={{ slug: post.slug }}
									className="rounded-lg border border-border p-4 transition-colors hover:bg-accent"
								>
									<div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
										<span>{post.author.username}</span>
										<span>·</span>
										<time>
											{formatDistanceToNow(new Date(post.published_at), {
												addSuffix: true,
												locale: zhCN,
											})}
										</time>
									</div>
									<h3 className="line-clamp-1 text-base font-medium hover:text-foreground">
										{post.title}
									</h3>
									<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>
								</Link>
							))}
				</div>
			</ScrollArea>
		</div>
	);
};

export default HeroRight;
