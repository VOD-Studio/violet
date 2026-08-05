import { useEffect, useRef, useState } from "react";

/**
 * useCountUp - 数字平滑滚动 hook
 *
 * target 变化时从当前显示值用 requestAnimationFrame 平滑过渡到新值。
 * 适用于轮询场景：每次数据刷新时数字从旧值动画到新值。
 *
 * @param target 目标值
 * @param duration 动画时长（ms），默认 800
 * @param decimals 保留小数位，默认 0
 */
export function useCountUp(target: number, duration = 800, decimals = 0): number {
	const [display, setDisplay] = useState(target);
	const fromRef = useRef(target);
	const rafRef = useRef<number>(0);

	useEffect(() => {
		const from = fromRef.current;
		const diff = target - from;
		if (diff === 0) return;

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
