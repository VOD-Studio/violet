import { useEffect, useState } from "react";

export interface ProgressInput {
	/** 容器滚动距离 */
	scrollTop: number;
	/** 内容总可滚动高度 */
	scrollHeight: number;
	/** 视口高度 */
	clientHeight: number;
}

/**
 * computeScrollProgress - 计算阅读进度百分比 0..100（纯函数）
 */
export function computeScrollProgress(input: ProgressInput): number {
	const { scrollTop, scrollHeight, clientHeight } = input;
	const max = scrollHeight - clientHeight;
	if (max <= 0) return 0;
	return Math.max(0, Math.min(100, (scrollTop / max) * 100));
}

/**
 * useScrollProgress - 监听容器滚动，返回进度 0..100
 */
export function useScrollProgress(ref: React.RefObject<HTMLElement | null>): number {
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const onScroll = () => {
			setProgress(
				computeScrollProgress({
					scrollTop: el.scrollTop,
					scrollHeight: el.scrollHeight,
					clientHeight: el.clientHeight,
				}),
			);
		};
		onScroll();
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, [ref]);

	return progress;
}
