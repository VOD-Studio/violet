import { useEffect, useRef, useState } from "react";

/** 加载持续多久才显示进度线，更短的切换不闪一下。 */
const SHOW_AFTER_MS = 300;
/** 首次出现时的进度。 */
const START_PROGRESS = 12;
/** 推进的上限：真正完成前不会到头。 */
const TRICKLE_CEILING = 90;
const TRICKLE_INTERVAL_MS = 200;
/** 每次推进走剩余距离的比例。 */
const TRICKLE_RATIO = 0.18;
/** 补满后停留多久再收起，让「到头」被看见。 */
const FINISH_HOLD_MS = 240;

/**
 * 把「是否在加载」变成页面加载进度线的数值。
 *
 * 加载满 300ms 才出现，之后逐渐推进但停在 90%；加载结束先补满到 100，停留片刻后收起。
 * 补满停留期间又开始新的加载，进度线从起点重新推进而不消失。
 *
 * @param loading - 当前是否在加载（如路由切换进行中）
 * @returns 0–100 的进度；没有进度线时为 `null`
 *
 * @example
 * ```tsx
 * const routing = useRoutingProgress(useRouterState({ select: (s) => s.isLoading }));
 * ```
 */
export function useRoutingProgress(loading: boolean): number | null {
	const [progress, setProgress] = useState<number | null>(null);
	/** 与 `progress !== null` 同步，供 effect 判断而不必把 progress 列为依赖。 */
	const visible = useRef(false);

	useEffect(() => {
		if (!loading) {
			if (!visible.current) return;
			setProgress(100);
			const hide = setTimeout(() => {
				visible.current = false;
				setProgress(null);
			}, FINISH_HOLD_MS);
			return () => clearTimeout(hide);
		}

		const show = () => {
			visible.current = true;
			setProgress((value) => (value === null || value === 100 ? START_PROGRESS : value));
		};
		let delay: ReturnType<typeof setTimeout> | undefined;
		if (visible.current) show();
		else delay = setTimeout(show, SHOW_AFTER_MS);
		const ticker = setInterval(
			() =>
				setProgress((value) =>
					value === null
						? value
						: Math.min(
								TRICKLE_CEILING,
								value + (TRICKLE_CEILING - value) * TRICKLE_RATIO,
							),
				),
			TRICKLE_INTERVAL_MS,
		);
		return () => {
			clearTimeout(delay);
			clearInterval(ticker);
		};
	}, [loading]);

	return progress;
}
