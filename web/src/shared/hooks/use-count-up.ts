import { useEffect, useRef, useState } from "react";

/**
 * useCountUp - 数字平滑滚动 Hook
 *
 * 首屏挂载时从 0 平滑滚动到目标值；后续数据刷新时从当前值平滑过渡到新值。
 *
 * @param target 目标值
 * @param duration 动画时长（ms），默认 800
 * @param decimals 保留小数位，默认 0
 * @param initial 初始起始值，默认 0
 */
export function useCountUp(target: number, duration = 800, decimals = 0, initial = 0): number {
	const [display, setDisplay] = useState(initial);
	const fromRef = useRef(initial);
	const rafRef = useRef<number>(0);

	useEffect(() => {
		const reduced =
			typeof window !== "undefined" && typeof window.matchMedia === "function"
				? window.matchMedia("(prefers-reduced-motion: reduce)").matches
				: false;
		if (reduced) {
			setDisplay(target);
			fromRef.current = target;
			return;
		}

		const from = fromRef.current;
		const diff = target - from;
		if (diff === 0) {
			setDisplay(target);
			return;
		}

		const start = performance.now();
		cancelAnimationFrame(rafRef.current);

		const tick = (now: number) => {
			const elapsed = now - start;
			const progress = Math.min(elapsed / duration, 1);
			// ease-out cubic
			const eased = 1 - (1 - progress) ** 3;
			const current = from + diff * eased;
			const factor = 10 ** decimals;
			setDisplay(Math.round(current * factor) / factor);
			if (progress < 1) {
				rafRef.current = requestAnimationFrame(tick);
			} else {
				fromRef.current = target;
			}
		};

		rafRef.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafRef.current);
	}, [target, duration, decimals]);

	return display;
}
