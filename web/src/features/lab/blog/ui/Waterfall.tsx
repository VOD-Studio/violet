import type { Post } from "@features/posts/model/types";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CascadeCard } from "./CascadeFlow";

// SSR 下 useLayoutEffect 会告警,水合后的分派才需要同步时机
const useAssignEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// 无实测列高时的批内选列预估
const FALLBACK_CARD_HEIGHT = 360;

/**
 * Waterfall - 分列瀑布容器
 *
 * 新卡片只追加进当前最矮列,已放置的不再移动;列高由 ResizeObserver 实测,
 * 懒加载封面加载完后自动校正。SSR/水合首帧渲染 CSS columns 版本(服务端无
 * matchMedia,两端标记需一致),挂载后切换为 JS 分列;断点或列表整体变化时
 * 才整体重分配。
 */
export function Waterfall({ posts }: { posts: Post[] }) {
	const count = useColumnCount();
	const [cols, setCols] = useState<Post[][] | null>(null);
	// firstId 识别列表整体替换(如切换筛选),替换或列数变化时全量重分派
	const assignRef = useRef({
		count: 0,
		firstId: "",
		map: new Map<string, number>(),
	});
	const heightsRef = useRef<number[]>([]);
	const colElsRef = useRef<Array<HTMLDivElement | null>>([]);

	useAssignEffect(() => {
		if (count === null) return;
		const a = assignRef.current;
		const replaced = a.map.size > 0 && posts.length > 0 && posts[0].id !== a.firstId;
		if (a.count !== count || replaced) {
			a.map.clear();
			a.count = count;
			heightsRef.current = Array<number>(count).fill(0);
		}
		a.firstId = posts[0]?.id ?? "";
		const heights = [...heightsRef.current];
		const placed = a.map.size;
		const avg =
			placed > 0 ? heights.reduce((sum, h) => sum + h, 0) / placed : FALLBACK_CARD_HEIGHT;
		for (const p of posts) {
			if (a.map.has(p.id)) continue;
			let target = 0;
			for (let c = 1; c < count; c++) {
				if (heights[c] < heights[target]) target = c;
			}
			a.map.set(p.id, target);
			heights[target] += avg;
		}
		heightsRef.current = heights;
		const next: Post[][] = Array.from({ length: count }, () => []);
		for (const p of posts) next[a.map.get(p.id) ?? 0].push(p);
		setCols(next);
	}, [posts, count]);

	useEffect(() => {
		if (count === null || cols === null) return;
		const obs = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const idx = colElsRef.current.indexOf(entry.target as HTMLDivElement);
				if (idx >= 0) heightsRef.current[idx] = entry.contentRect.height;
			}
		});
		for (const el of colElsRef.current) if (el) obs.observe(el);
		return () => obs.disconnect();
	}, [count, cols]);

	if (cols === null || count === null) {
		return (
			<div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
				{posts.map((p, i) => (
					<CascadeCard key={p.id} post={p} index={i} />
				))}
			</div>
		);
	}
	const indexMap = new Map(posts.map((p, i) => [p.id, i] as const));
	return (
		<div className="flex items-start gap-6">
			{cols.map((colPosts, ci) => (
				<div
					key={ci}
					ref={(el) => {
						colElsRef.current[ci] = el;
					}}
					className="min-w-0 flex-1"
				>
					{colPosts.map((p) => (
						<CascadeCard key={p.id} post={p} index={indexMap.get(p.id) ?? 0} />
					))}
				</div>
			))}
		</div>
	);
}

// 列数断点对齐 CSS columns 兜底分支的 sm/lg 前缀
function useColumnCount() {
	const [count, setCount] = useState<number | null>(null);
	useEffect(() => {
		const lg = window.matchMedia("(min-width: 1024px)");
		const sm = window.matchMedia("(min-width: 640px)");
		const update = () => setCount(lg.matches ? 3 : sm.matches ? 2 : 1);
		update();
		lg.addEventListener("change", update);
		sm.addEventListener("change", update);
		return () => {
			lg.removeEventListener("change", update);
			sm.removeEventListener("change", update);
		};
	}, []);
	return count;
}
