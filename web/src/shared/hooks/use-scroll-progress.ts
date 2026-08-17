import { useEffect, useState } from "react";

/** 滚动进度计算入参 */
export interface ProgressInput {
	/** 容器已滚动距离 */
	scrollTop: number;
	/** 内容总可滚动高度 */
	scrollHeight: number;
	/** 视口高度 */
	clientHeight: number;
}

/**
 * 根据容器尺寸与滚动距离计算滚动百分比（0..100 纯函数）。
 *
 * @param input - 滚动高度与位置入参
 * @returns 0 到 100 的百分比数值
 */
export function computeScrollProgress(input: ProgressInput): number {
	const { scrollTop, scrollHeight, clientHeight } = input;
	const max = scrollHeight - clientHeight;
	if (max <= 0) return 0;
	return Math.max(0, Math.min(100, (scrollTop / max) * 100));
}

/**
 * 监听目标容器（或窗口）的滚动位置，实时返回当前阅读进度百分比（0..100）。
 *
 * @param ref - 可选自定义滚动容器 DOM Ref，省略时监听整个 window
 *
 * @returns 0 到 100 的进度数字
 *
 * @example
 * ```tsx
 * const progress = useScrollProgress();
 * return <div style={{ width: `${progress}%` }} className="progress-bar" />;
 * ```
 */
export function useScrollProgress(ref?: React.RefObject<HTMLElement | null>): number {
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		const onScroll = () => {
			if (!ref) {
				setProgress(
					computeScrollProgress({
						scrollTop: document.documentElement.scrollTop || document.body.scrollTop,
						scrollHeight: document.documentElement.scrollHeight,
						clientHeight: document.documentElement.clientHeight,
					}),
				);
			} else {
				const el = ref.current;
				if (!el) return;
				setProgress(
					computeScrollProgress({
						scrollTop: el.scrollTop,
						scrollHeight: el.scrollHeight,
						clientHeight: el.clientHeight,
					}),
				);
			}
		};
		onScroll();

		if (!ref) {
			window.addEventListener("scroll", onScroll, { passive: true });
			return () => window.removeEventListener("scroll", onScroll);
		}

		const el = ref.current;
		if (el) {
			el.addEventListener("scroll", onScroll, { passive: true });
			return () => el.removeEventListener("scroll", onScroll);
		}
	}, [ref]);

	return progress;
}
