import { BlogSkeleton } from "@features/lab/blog/ui/BlogSkeleton";
import { CascadeFlow } from "@features/lab/blog/ui/CascadeFlow";
import Empty from "@shared/ui/empty";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { postKeys } from "../api/keys";
import { fetchPosts, usePosts } from "../api/queries";

/**
 * BlogCascade - 博客列表页（主轴瀑布 + 触底翻页）
 *
 * 翻页用 useQueries 动态页数组（每页一个普通 query，与 loader 预取
 * 同 key，SSR 首屏直出；useInfiniteQuery 在本站 SSR 管线中会使路由
 * 组件不执行，见 git 历史）。全部页的卡片并入同一个瀑布容器——
 * 分页边界不切断列流，无页间断层留白。哨兵只在「还有下一页且最后一
 * 页已渲染」时挂载，未滚动不级联拉页。
 */
export default function BlogCascade({ limit = 12 }: { limit?: number }) {
	// 第一页独立 useQuery：与 loader 预取同 key，拿分页元数据驱动翻页
	const first = usePosts({ page: 1, limit });
	const totalPages = first.data?.pagination.total_pages ?? 1;

	const [pages, setPages] = useState(1);
	useEffect(() => {
		if (pages > totalPages) setPages(totalPages);
	}, [pages, totalPages]);

	// 追加页（page 2..pages）
	const more = useQueries({
		queries: Array.from({ length: Math.max(0, pages - 1) }, (_, i) => ({
			queryKey: postKeys.list({ page: i + 2, limit }),
			queryFn: () => fetchPosts({ page: i + 2, limit }),
		})),
	});
	const loadingLast = pages > 1 && more[more.length - 1]?.isLoading;
	const hasMore = pages < totalPages;

	// 触底哨兵：真实用户输入（滚轮/触摸/按键）后才武装——首屏图片未加载
	// 时瀑布不足一屏，哨兵会可见；且浏览器滚动位置恢复会发 scroll 事件，
	// 不能用它当"用户滚动过"的信号
	const sentinelRef = useRef<HTMLDivElement>(null);
	const [armed, setArmed] = useState(false);
	useEffect(() => {
		const arm = () => setArmed(true);
		window.addEventListener("wheel", arm, { once: true, passive: true });
		window.addEventListener("touchmove", arm, { once: true, passive: true });
		window.addEventListener("keydown", arm, { once: true, passive: true });
		return () => {
			window.removeEventListener("wheel", arm);
			window.removeEventListener("touchmove", arm);
			window.removeEventListener("keydown", arm);
		};
	}, []);
	useEffect(() => {
		const el = sentinelRef.current;
		if (!el || !armed || !hasMore || loadingLast) return;
		const obs = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) setPages((p) => p + 1);
			},
			{ rootMargin: "300px 0px" },
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, [armed, hasMore, loadingLast]);

	if (first.isLoading) {
		return <BlogSkeleton direction="cascade" />;
	}
	if (first.isError) {
		return (
			<Empty
				title="加载失败"
				description={first.error instanceof Error ? first.error.message : "未知错误"}
				className="py-20"
			/>
		);
	}

	const firstItems = [...(first.data?.data ?? [])].sort(
		(a, b) => Number(b.is_featured) - Number(a.is_featured),
	);
	if (!firstItems.length) {
		return <Empty title="暂无文章" description="还没有发布任何内容" className="py-20" />;
	}

	const rest = [...firstItems.slice(1), ...more.flatMap((q) => q.data?.data ?? [])];

	return (
		<div>
			{/* hero + 跨页统一瀑布容器：分页边界不断列流 */}
			<CascadeFlow posts={[firstItems[0], ...rest]} />
			{loadingLast ? <ShimmerSkeleton className="mx-auto mt-6 h-4 w-40" /> : null}
			{hasMore && !loadingLast ? <div ref={sentinelRef} aria-hidden className="h-4" /> : null}
		</div>
	);
}
