import { ScrollArea } from "@shared/ui/scroll-area";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { useEffect, useMemo, useRef, useState } from "react";

import { usePosts } from "../api/queries";
import type { PostListQuery } from "../model/types";
import PostCard from "./PostCard";

export interface PostListProps {
	query?: PostListQuery;
	showSkeleton?: boolean;
	/** 每行卡片视觉尺寸轮转，实现「大小不一不崩塌」 */
	mixedSizes?: ("sm" | "md" | "lg")[];
	className?: string;
}

const ROW_HEIGHT: Record<"sm" | "md" | "lg", number> = {
	sm: 240,
	md: 340,
	lg: 440,
};
const GAP = 16;

/**
 * PostList - 文章虚拟列表
 *
 * spec：
 * - 虚拟列表渲染，支持大小不一卡片而不崩塌
 * - 上下滚动带线性渐隐遮罩（ScrollArea 提供 mask）
 *
 * 实现：手写垂直窗口化（无重型依赖）。每项高度由 mixedSizes[i % len] 决定，
 * 估算可见区间，只渲染可见 + 上下各 buffer 像素的项。
 *
 * 三态保留：loading→shimmer 骨架，error→文案，空→提示。
 * 数据层（usePosts）不动。
 */
const PostList = ({
	query = {},
	showSkeleton = true,
	mixedSizes = ["md", "md", "lg"],
	className,
}: PostListProps) => {
	const { data, isLoading, isError, error } = usePosts(query);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [viewportH, setViewportH] = useState(800);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const onScroll = () => setScrollTop(el.scrollTop);
		const onResize = () => setViewportH(el.clientHeight);
		onResize();
		el.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", onResize);
		return () => {
			el.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onResize);
		};
	}, []);

	const items = data?.data ?? [];
	const sizes = useMemo(() => mixedSizes, [mixedSizes]);

	// 预计算每项 top 与总高度（按尺寸轮转的固定行高估算）
	const layout = useMemo(() => {
		let acc = 0;
		const tops = items.map((_, i) => {
			const h = ROW_HEIGHT[sizes[i % sizes.length] ?? "md"] + GAP;
			const top = acc;
			acc += h;
			return top;
		});
		return { tops, totalH: Math.max(0, acc - GAP) };
	}, [items, sizes]);

	if (isLoading && showSkeleton) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: query.limit ?? 6 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: 静态骨架
					<ShimmerSkeleton key={`sk-${i}`} className="h-72" />
				))}
			</div>
		);
	}

	if (isError) {
		return (
			<p className="py-12 text-center text-muted-foreground">
				加载失败：{error instanceof Error ? error.message : "未知错误"}
			</p>
		);
	}

	if (!items.length) {
		return <p className="py-12 text-center text-muted-foreground">暂无文章</p>;
	}

	// 垂直窗口化：找出与 [scrollTop - buffer, scrollTop + viewportH + buffer] 相交的项
	const buffer = 600;
	let startIdx = 0;
	for (let i = 0; i < items.length; i++) {
		const h = ROW_HEIGHT[sizes[i % sizes.length] ?? "md"] + GAP;
		if (layout.tops[i] + h > scrollTop - buffer) {
			startIdx = i;
			break;
		}
	}
	let endIdx = items.length;
	for (let i = startIdx; i < items.length; i++) {
		if (layout.tops[i] > scrollTop + viewportH + buffer) {
			endIdx = i;
			break;
		}
	}
	const visible = items.slice(startIdx, endIdx);

	return (
		<ScrollArea
			ref={scrollRef}
			className={className}
			style={{ maxHeight: "70vh" }}
		>
			<div style={{ height: layout.totalH, position: "relative" }}>
				{visible.map((post, i) => {
					const idx = startIdx + i;
					const size = sizes[idx % sizes.length] ?? "md";
					return (
						<div
							key={post.id}
							style={{
								position: "absolute",
								top: layout.tops[idx],
								left: 0,
								right: 0,
							}}
						>
							<PostCard post={post} size={size} />
						</div>
					);
				})}
			</div>
		</ScrollArea>
	);
};

export default PostList;
