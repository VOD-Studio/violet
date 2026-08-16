import { BlogSkeleton } from "@features/lab/blog/ui/BlogSkeleton";
import { CascadeFlow } from "@features/lab/blog/ui/CascadeFlow";
import Empty from "@shared/ui/empty";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { useEffect, useRef } from "react";
import { useInfinitePosts } from "../api/queries";

/**
 * BlogCascade - 博客列表页（主轴瀑布方向 + 触底无限加载）
 *
 * blog-lab 主轴瀑布选型落生产：最新一篇全宽主轴（封面 + 渐变遮罩 +
 * 大字浮排），其余 CSS columns 自然高度瀑布流，无封面退化为排版卡。
 * 第一页精选置顶做主轴；触底自动翻页（useInfinitePosts），
 * total_pages 用尽即停。
 */
export default function BlogCascade({ limit = 12 }: { limit?: number }) {
	const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
		useInfinitePosts(limit);

	// 触底哨兵：进入视口即翻页
	const sentinelRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = sentinelRef.current;
		if (!el || !hasNextPage || isFetchingNextPage) return;
		const obs = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) fetchNextPage();
			},
			{ rootMargin: "600px 0px" },
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	if (isLoading) {
		return <BlogSkeleton direction="cascade" />;
	}

	if (isError) {
		return (
			<Empty
				title="加载失败"
				description={error instanceof Error ? error.message : "未知错误"}
				className="py-20"
			/>
		);
	}

	const pages = data?.pages ?? [];
	const firstPage = pages[0]?.data ?? [];
	if (!firstPage.length) {
		return <Empty title="暂无文章" description="还没有发布任何内容" className="py-20" />;
	}

	// 首页精选置顶（主轴语义：精选/最新做 hero），后续页按返回序追加
	const hero = [...firstPage].sort((a, b) => Number(b.is_featured) - Number(a.is_featured))[0];
	const rest = [
		...firstPage.filter((p) => p.id !== hero.id),
		...pages.slice(1).flatMap((pg) => pg.data),
	];

	return (
		<div>
			<CascadeFlow posts={[hero, ...rest]} />
			{hasNextPage ? (
				<div ref={sentinelRef} aria-hidden className="mt-2 flex justify-center py-6">
					{isFetchingNextPage ? <ShimmerSkeleton className="h-4 w-40" /> : null}
				</div>
			) : null}
		</div>
	);
}
