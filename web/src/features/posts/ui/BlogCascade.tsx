import { BlogSkeleton } from "@features/lab/blog/ui/BlogSkeleton";
import { CascadeFlow } from "@features/lab/blog/ui/CascadeFlow";
import Empty from "@shared/ui/empty";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { useEffect, useRef, useState } from "react";
import { usePosts } from "../api/queries";

/**
 * PostsPage - 追加页渲染：每页一个独立 usePosts（普通 query，SSR 安全）
 *
 * page=1 由 loader 预取同 key，SSR 首屏直出（见 FirstPage）；后续页
 * 触底后按页号新增实例追加。不使用 useInfiniteQuery——该 hook 在本站
 * SSR 渲染管线中导致路由组件整体不执行。
 */
function PostsPage({
	page,
	limit,
	className,
}: {
	page: number;
	limit: number;
	className?: string;
}) {
	const { data, isLoading, isError, error } = usePosts({ page, limit });

	if (isLoading) {
		return <ShimmerSkeleton className="h-8" />;
	}
	if (isError) {
		return (
			<p className="py-4 text-sm text-muted-foreground">
				加载失败：{error instanceof Error ? error.message : "未知错误"}
			</p>
		);
	}
	const items = data?.data ?? [];
	if (!items.length) return null;
	return (
		<div className={className}>
			<CascadeFlow posts={items} noHero />
		</div>
	);
}

/**
 * BlogCascade - 博客列表页（主轴瀑布 + 触底翻页）
 *
 * 第一页 SSR 直出（hero 取首页精选置顶）；触底自动加载下一页追加。
 * 翻页实现为「每页一个普通 query 实例」，回避 useInfiniteQuery 的
 * SSR 兼容问题。
 */
export default function BlogCascade({ limit = 12 }: { limit?: number }) {
	const [pages, setPages] = useState(1);
	const [totalPages, setTotalPages] = useState(1);

	// 触底哨兵：进入视口即加载下一页
	const sentinelRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = sentinelRef.current;
		if (!el || pages >= totalPages) return;
		const obs = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) setPages((p) => Math.min(p + 1, totalPages));
			},
			{ rootMargin: "600px 0px" },
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, [pages, totalPages]);

	const hasMore = pages < totalPages;

	return (
		<div>
			{/* 第一页：SSR 直出（loader 已按同 key 预取） */}
			<FirstPage limit={limit} onTotalPages={setTotalPages} />
			{/* 追加页 */}
			{Array.from({ length: pages - 1 }, (_, i) => (
				<PostsPage key={i + 2} page={i + 2} limit={limit} className="mt-10" />
			))}
			{hasMore ? <div ref={sentinelRef} aria-hidden className="h-4" /> : null}
		</div>
	);
}

/** 第一页单独组件：首屏骨架/错误/空三态 + 精选置顶做主轴 */
function FirstPage({ limit, onTotalPages }: { limit: number; onTotalPages: (n: number) => void }) {
	const { data, isLoading, isError, error } = usePosts({ page: 1, limit });

	useEffect(() => {
		if (data?.pagination.total_pages) onTotalPages(data.pagination.total_pages);
	}, [data, onTotalPages]);

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
	const items = [...(data?.data ?? [])].sort(
		(a, b) => Number(b.is_featured) - Number(a.is_featured),
	);
	if (!items.length) {
		return <Empty title="暂无文章" description="还没有发布任何内容" className="py-20" />;
	}
	return <CascadeFlow posts={items} />;
}
