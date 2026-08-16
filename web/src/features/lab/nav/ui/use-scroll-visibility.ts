import type { RefObject } from "react";
import { useEffect, useState } from "react";

/**
 * useScrollVisibility - lab 演示滚动容器的滚动状态
 *
 * past：滚过首屏阈值（200px）；movingUp：正在向上滚（触发时距顶 80px
 * 以上，防顶部抖动），带 1.2s 驻留——手势末尾的亚像素滚动事件会把增量
 * 清零，立即翻转会让胶囊闪烁消失；progress：0-1 阅读进度。rAF 节流的
 * 容器级 scroll 监听，只服务演示体量；生产落地换 motion useScroll 或
 * IntersectionObserver 哨兵。
 */
export function useScrollVisibility(ref: RefObject<HTMLDivElement | null>) {
	const [past, setPast] = useState(false);
	const [movingUp, setMovingUp] = useState(false);
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		let raf = 0;
		let upHold = 0;
		let lastY = el.scrollTop;
		const onScroll = () => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
				const y = el.scrollTop;
				const range = el.scrollHeight - el.clientHeight;
				setPast(y > 200);
				setProgress(range > 0 ? y / range : 0);
				if (y > 80 && y < lastY - 2) {
					setMovingUp(true);
					window.clearTimeout(upHold);
					upHold = window.setTimeout(() => setMovingUp(false), 1200);
				} else if (y > lastY + 2) {
					// 明确向下滚立即收起，不等驻留到期
					window.clearTimeout(upHold);
					setMovingUp(false);
				}
				lastY = y;
			});
		};
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			el.removeEventListener("scroll", onScroll);
			cancelAnimationFrame(raf);
			window.clearTimeout(upHold);
		};
	}, [ref]);

	return { past, movingUp, progress };
}
