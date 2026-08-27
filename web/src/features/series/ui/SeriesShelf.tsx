import { fetchSeries, seriesKeys, useSeries } from "@features/series/api";
import type { SeriesSummary } from "@features/series/model/types";
import { BookCover } from "@features/series/ui/BookCover";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

const PAGE_LIMIT = 24;

function formatDate(s: string): string {
	if (!s) return "";
	const d = new Date(s);
	return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("zh-CN");
}

function ShelfCard({ book }: { book: SeriesSummary }) {
	return (
		<Link
			to="/series/$slug"
			params={{ slug: book.slug }}
			className="mx-auto block w-full max-w-56 focus-visible:outline-2"
		>
			<BookCover book={book} className="w-full" />
			<h3 className="mt-4 line-clamp-1 font-semibold">{book.title}</h3>
			<p className="text-muted-foreground mt-1 line-clamp-1 text-sm">
				{book.chapter_count > 0 ? `${book.chapter_count} 章` : "尚未挂章"}
				{book.latest_chapter_at ? ` · ${formatDate(book.latest_chapter_at)}` : ""}
			</p>
		</Link>
	);
}

function ShelfSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
			{Array.from({ length: 8 }).map((_, i) => (
				<div key={i} className="mx-auto w-full max-w-56">
					<ShimmerSkeleton className="aspect-2/3 w-full rounded-sm" />
					<ShimmerSkeleton className="mt-4 h-5 w-4/5 rounded-md" />
					<ShimmerSkeleton className="mt-1.5 h-4 w-2/3 rounded-md" />
				</div>
			))}
		</div>
	);
}

/**
 * 书架列表：useQueries 动态页数组（useInfiniteQuery 在本站 SSR 管线中会使
 * 路由组件不执行，见 BlogCascade 注释与 git 历史），触底哨兵追加下一页。
 */
export function SeriesShelf() {
	const first = useSeries({ page: 1, limit: PAGE_LIMIT });
	const qc = useQueryClient();
	const [pages, setPages] = useState(1);
	const sentinelRef = useRef<HTMLDivElement>(null);

	const totalPages = first.data?.pagination?.total_pages ?? 1;
	const pageQueries = useQueries({
		queries: Array.from({ length: pages }, (_, i) => ({
			queryKey: seriesKeys.list({ page: i + 1, limit: PAGE_LIMIT }),
			queryFn: () => fetchSeries({ page: i + 1, limit: PAGE_LIMIT }),
			staleTime: 60_000,
		})),
	});
	const books = pageQueries.flatMap((q) => q.data?.data ?? []);

	// 触底追加下一页（真实交互后才武装，与 BlogCascade 同款防自动预滚）
	const armed = useRef(false);
	useEffect(() => {
		const arm = () => {
			armed.current = true;
		};
		window.addEventListener("wheel", arm, { once: true, passive: true });
		window.addEventListener("touchmove", arm, { once: true, passive: true });
		window.addEventListener("keydown", arm, { once: true });
		return () => {
			window.removeEventListener("wheel", arm);
			window.removeEventListener("touchmove", arm);
			window.removeEventListener("keydown", arm);
		};
	}, []);
	useEffect(() => {
		const el = sentinelRef.current;
		if (!el || armed.current === false) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && pages < totalPages && !first.isFetching) {
					// 先 ensure 下一页（命中 loader 预取同 key 的缓存），再追加渲染
					void qc
						.ensureQueryData({
							queryKey: seriesKeys.list({ page: pages + 1, limit: PAGE_LIMIT }),
							queryFn: () => fetchSeries({ page: pages + 1, limit: PAGE_LIMIT }),
						})
						.then(() => setPages((p) => p + 1))
						.catch(() => {});
				}
			},
			{ rootMargin: "300px 0px" },
		);
		io.observe(el);
		return () => io.disconnect();
	}, [pages, totalPages, first.isFetching, qc]);

	if (first.isLoading) return <ShelfSkeleton />;
	if (first.isError) {
		return (
			<Empty
				title="加载失败"
				description="书架暂时拉不到，稍后再试试"
				action={
					<Button variant="outline" size="sm" onClick={() => void first.refetch()}>
						重试
					</Button>
				}
				className="py-20"
			/>
		);
	}
	if (!books.length) {
		return (
			<Empty title="暂无书籍" description="还没有发布的系列书" className="py-20" size="lg" />
		);
	}

	return (
		<div>
			<div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
				{books.map((book) => (
					<ShelfCard key={book.id} book={book} />
				))}
			</div>
			{pages < totalPages && <div ref={sentinelRef} aria-hidden="true" className="h-1" />}
		</div>
	);
}
