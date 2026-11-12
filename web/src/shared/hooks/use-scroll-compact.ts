import { useEffect, useState } from "react";

/** 向下滚动超过此距离才会收起 */
const COMPACT_AFTER_PX = 80;
/** 单次滚动方向判定的最小位移，过滤抖动 */
const SCROLL_DELTA_PX = 6;

/**
 * 向下滚动收起、向上滚动或回到顶部恢复的窗口滚动状态。
 *
 * 导航栏与移动端底部岛共用：同一阈值保证两处收起与恢复的时机一致。
 *
 * @returns `[compact, setCompact]`；`setCompact` 供调用方在点按收起态时手动展开。
 *
 * @example
 * ```tsx
 * const [compact, setCompact] = useScrollCompact();
 * return <nav data-compact={compact} onClick={() => setCompact(false)} />;
 * ```
 */
export function useScrollCompact(): [boolean, (value: boolean) => void] {
	const [compact, setCompact] = useState(false);
	useEffect(() => {
		let last = window.scrollY;
		let frame = 0;
		const update = () => {
			frame = 0;
			const y = window.scrollY;
			const delta = y - last;
			if (y <= COMPACT_AFTER_PX) setCompact(false);
			else if (delta > SCROLL_DELTA_PX) setCompact(true);
			else if (delta < -SCROLL_DELTA_PX) setCompact(false);
			if (Math.abs(delta) > SCROLL_DELTA_PX) last = y;
		};
		const onScroll = () => {
			if (frame === 0) frame = requestAnimationFrame(update);
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			if (frame !== 0) cancelAnimationFrame(frame);
			window.removeEventListener("scroll", onScroll);
		};
	}, []);
	return [compact, setCompact];
}
