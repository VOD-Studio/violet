import { useAdminAuditLogs } from "@features/admin-audit-logs/api/queries";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { TermPane } from "./TermPane";

/** 自动滚动速度（px/s），平缓舒适便于阅读 */
const SCROLL_SPEED = 10;
/**
 * 循环无缝滚动活动流。
 *
 * 自适应展示与大屏无缝循环：
 * - 内容未超出视口（如 1~2 条）：单份静止展示，不自动滚动，无冗余副本；
 * - 内容超出视口：采用三组副本与环形滚动映射实现无缝无限循环；
 * - 悬停时自动暂停，支持鼠标滚轮与触摸双向无限循环滚动，容器完全隐藏滚动条。
 */
export function ActivityTicker() {
	const { data, isLoading } = useAdminAuditLogs({ limit: 20 });
	const events = data?.data ?? [];
	const viewportRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);
	const singleGroupRef = useRef<HTMLUListElement>(null);
	const offsetRef = useRef(0);
	const singleHeightRef = useRef(0);
	const hoveringRef = useRef(false);
	const lastTouchYRef = useRef<number | null>(null);
	const [canScroll, setCanScroll] = useState(false);

	// 测量单组高度并决定是否需要循环滚动
	useEffect(() => {
		const groupEl = singleGroupRef.current;
		const viewportEl = viewportRef.current;
		if (!groupEl || !viewportEl || events.length === 0) return;

		const checkMetrics = () => {
			const h = groupEl.offsetHeight;
			const vh = viewportEl.clientHeight;
			singleHeightRef.current = h;
			const scrollable = h > vh;
			setCanScroll(scrollable);
			if (!scrollable) {
				offsetRef.current = 0;
				if (trackRef.current) {
					trackRef.current.style.transform = "translateY(0px)";
				}
			}
		};

		checkMetrics();

		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(checkMetrics);
		observer.observe(groupEl);
		observer.observe(viewportEl);
		return () => observer.disconnect();
	}, [events]);

	// rAF 自动滚动
	useEffect(() => {
		const reduced =
			typeof window !== "undefined" && typeof window.matchMedia === "function"
				? window.matchMedia("(prefers-reduced-motion: reduce)").matches
				: false;
		if (reduced || !canScroll || events.length === 0) return;

		let raf = 0;
		let last = performance.now();

		const step = (now: number) => {
			const dt = (now - last) / 1000;
			last = now;

			if (!hoveringRef.current && singleHeightRef.current > 0) {
				const h = singleHeightRef.current;
				let next = offsetRef.current + SCROLL_SPEED * dt;
				if (next >= h) {
					next -= h;
				}
				offsetRef.current = next;
				if (trackRef.current) {
					trackRef.current.style.transform = `translateY(-${next}px)`;
				}
			}
			raf = requestAnimationFrame(step);
		};

		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [canScroll, events.length]);

	const applyDelta = (delta: number) => {
		const h = singleHeightRef.current;
		if (!canScroll || h <= 0) return;

		let next = (offsetRef.current + delta) % h;
		if (next < 0) {
			next += h;
		}
		offsetRef.current = next;
		if (trackRef.current) {
			trackRef.current.style.transform = `translateY(-${next}px)`;
		}
	};

	const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
		if (!canScroll) return;
		applyDelta(e.deltaY);
	};

	const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
		hoveringRef.current = true;
		lastTouchYRef.current = e.touches[0]?.clientY ?? null;
	};

	const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
		const currentY = e.touches[0]?.clientY;
		if (currentY == null || lastTouchYRef.current == null) return;
		const deltaY = lastTouchYRef.current - currentY;
		lastTouchYRef.current = currentY;
		applyDelta(deltaY);
	};

	const handleTouchEnd = () => {
		hoveringRef.current = false;
		lastTouchYRef.current = null;
	};

	const renderList = (isClone = false) => (
		<ul ref={isClone ? undefined : singleGroupRef} aria-hidden={isClone ? "true" : undefined}>
			{events.map((event, index) => (
				<li
					key={isClone ? `clone-${event.event_id}-${index}` : event.event_id}
					className="flex items-baseline gap-2.5 px-4 py-1.5 font-mono text-xs"
				>
					<span className="text-muted-foreground shrink-0">
						{format(new Date(event.occurred_at), "MM-dd HH:mm")}
					</span>
					<span className="text-muted-foreground shrink-0 select-none">›</span>
					<span className="truncate">
						{event.summary ||
							`${event.actor.user_name} ${event.action} ${event.resource.type}`}
					</span>
				</li>
			))}
		</ul>
	);

	return (
		<TermPane
			tag="~/activity"
			title="最近活动"
			fill={false}
			trailing={
				<span className="flex items-center gap-1.5 text-xs text-emerald-500">
					<span
						className="size-1.5 animate-pulse rounded-full bg-emerald-500"
						aria-hidden
					/>
					live
				</span>
			}
		>
			{isLoading ? (
				<div className="h-40" aria-busy />
			) : events.length === 0 ? (
				<div className="text-muted-foreground flex h-40 items-center px-4 font-mono text-xs">
					awaiting events
					<span className="animate-[caret-blink_1s_step-end_infinite]">▊</span>
				</div>
			) : (
				<div
					ref={viewportRef}
					className="h-40 cursor-default select-none overflow-hidden"
					onWheel={handleWheel}
					onMouseEnter={() => {
						hoveringRef.current = true;
					}}
					onMouseLeave={() => {
						hoveringRef.current = false;
					}}
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
				>
					<div ref={trackRef} className="will-change-transform">
						{renderList(false)}
						{canScroll && renderList(true)}
					</div>
				</div>
			)}
		</TermPane>
	);
}
