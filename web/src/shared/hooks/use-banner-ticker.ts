import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * 同一 rAF 时钟驱动进度与换页；悬停或聚焦暂停，手动翻页重置计时。
 * 减少动态效果偏好下只保留手动翻页。
 */
export function useBannerTicker(n: number, intervalMs = 5000) {
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);
	/** 当前公告已驻留时长（ms），rAF 里读写，不进 effect 依赖 */
	const elapsedRef = useRef(0);
	const [progress, setProgress] = useState(0);
	const reduced = usePrefersReducedMotion();

	useEffect(() => {
		if (paused || reduced || n <= 1) return;
		let raf = 0;
		let start = performance.now() - elapsedRef.current;
		const loop = (t: number) => {
			const elapsed = t - start;
			if (elapsed >= intervalMs) {
				elapsedRef.current = 0;
				setProgress(0);
				setIndex((i) => (i + 1) % n);
				start = t; // 重置下一轮驻留基准，否则 elapsed 立即又超时
				raf = requestAnimationFrame(loop);
				return;
			}
			elapsedRef.current = elapsed;
			setProgress(elapsed / intervalMs);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, [paused, reduced, n, intervalMs]);

	/** 手动翻页：同一时钟归零重走 */
	const step = (dir: number) => {
		elapsedRef.current = 0;
		setProgress(0);
		setIndex((i) => (i + dir + n) % n);
	};

	const hoverHandlers = {
		onMouseEnter: () => setPaused(true),
		onMouseLeave: () => setPaused(false),
		onFocus: () => setPaused(true),
		onBlur: () => setPaused(false),
	};

	const wheelRef = useWheelStep(step);

	return { index, progress, paused, setPaused, step, hoverHandlers, wheelRef };
}

/** 检测并跟随系统的减少动态效果偏好。 */
export function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReduced(mq.matches);
		const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);
	return reduced;
}

/**
 * React wheel 事件为被动监听，这里用原生监听拦截页面滚动。
 * 400ms 冷却避免触控板惯性连续翻页；低于 4 的抖动只拦截、不翻页。
 */
export function useWheelStep(onStep: (dir: number) => void): RefObject<HTMLDivElement | null> {
	const ref = useRef<HTMLDivElement | null>(null);
	const cbRef = useRef(onStep);
	cbRef.current = onStep;
	const lastStepRef = useRef(0);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const handler = (e: globalThis.WheelEvent) => {
			if (e.deltaY === 0) return;
			e.preventDefault();
			if (Math.abs(e.deltaY) < 4) return; // 极小抖动：拦下页面但不翻页
			const now = performance.now();
			if (now - lastStepRef.current < 400) return; // 触控板惯性冷却
			lastStepRef.current = now;
			cbRef.current(e.deltaY > 0 ? 1 : -1);
		};
		el.addEventListener("wheel", handler, { passive: false });
		return () => el.removeEventListener("wheel", handler);
	}, []);

	return ref;
}
