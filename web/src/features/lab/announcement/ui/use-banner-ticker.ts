import { useEffect, useState, type WheelEvent } from "react";

/**
 * 横幅方向的轮换节拍：自动推进 + hover/focus 暂停 + 滚轮手动翻。
 * WCAG 2.2.2 底线的 lab 实现（生产 AnnouncementBar 同款约束），
 * prefers-reduced-motion 的静态降级由各方向组件自行处理。
 */
export function useBannerTicker(n: number, intervalMs = 5000) {
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);

	useEffect(() => {
		if (paused || n <= 1) return;
		const timer = window.setInterval(() => setIndex((i) => (i + 1) % n), intervalMs);
		return () => window.clearInterval(timer);
	}, [paused, n, intervalMs]);

	useEffect(() => {
		if (index >= n) setIndex(0);
	}, [n, index]);

	const step = (dir: number) => setIndex((i) => (i + dir + n) % n);

	const handlers = {
		onMouseEnter: () => setPaused(true),
		onMouseLeave: () => setPaused(false),
		onFocus: () => setPaused(true),
		onBlur: () => setPaused(false),
		onWheel: (e: WheelEvent) => {
			if (Math.abs(e.deltaY) < 10) return;
			step(e.deltaY > 0 ? 1 : -1);
		},
	};

	return { index, paused, intervalMs, step, handlers };
}
