import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * 横幅方向的轮换节拍：单一 rAF 时钟同时驱动换页与进度——
 * hover/focus 暂停、滚轮手动翻都作用于同一时钟，进度与换页
 * 永不漂移（此前 setInterval + CSS 动画双时钟会各自走完）。
 * WCAG 2.2.2 底线（可暂停/可手动翻）；prefers-reduced-motion
 * 下停自动推进、滚轮手动翻仍可用（静态降级）。
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

/** prefers-reduced-motion 检测（lab 版，生产 AnnouncementBar 有同款私有实现） */
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
 * 滚轮接管：原生非被动监听 + preventDefault——React 合成 wheel
 * 事件是 passive 的，拦不下页面滚动。触控板惯性滚动是大量
 * 小 delta 事件（低于旧阈值会被放行、页面跟着滚），所以这里
 * 对任何非零 delta 都 preventDefault 锁死页面，翻页带 400ms
 * 冷却防止一次轻扫连翻多页。返回 ref 挂到接管滚轮的容器上。
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
