const MIN_DURATION_MS = 380;
const MAX_DURATION_MS = 1000;
const INTERRUPT_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

let cancelCurrent: (() => void) | null = null;

/** 三次缓入缓出：起止平缓，中段加速。 */
export function easeInOutCubic(progress: number): number {
	return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

/**
 * 按滚动距离换算时长：近距离快速到位，远距离不超过上限。
 *
 * @param distance - 滚动距离（px，取绝对值）
 */
export function smoothScrollDuration(distance: number): number {
	const duration = MIN_DURATION_MS + Math.sqrt(Math.abs(distance)) * 14;
	return Math.min(duration, MAX_DURATION_MS);
}

/**
 * 把元素平滑滚动到视口顶部（计入 scroll-margin-top）。
 *
 * @param target - 目标元素
 * @param reduced - 偏好减弱动态时直接跳转
 * @remarks 用户滚轮、触摸、按键或点击会立即中断动画；新的滚动会取消进行中的旧动画。
 */
export function scrollToElement(target: HTMLElement, reduced: boolean): void {
	cancelCurrent?.();
	const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
	const maxY = document.documentElement.scrollHeight - window.innerHeight;
	const toY = Math.min(
		Math.max(Math.round(target.getBoundingClientRect().top + window.scrollY - margin), 0),
		Math.max(maxY, 0),
	);
	const fromY = window.scrollY;
	const distance = toY - fromY;
	if (reduced || Math.abs(distance) < 2) {
		window.scrollTo({ top: toY, behavior: "instant" });
		return;
	}

	const duration = smoothScrollDuration(distance);
	const startedAt = performance.now();
	let frame = 0;
	const stop = () => {
		cancelAnimationFrame(frame);
		for (const type of INTERRUPT_EVENTS) window.removeEventListener(type, stop);
		if (cancelCurrent === stop) cancelCurrent = null;
	};
	const step = (now: number) => {
		const progress = Math.min((now - startedAt) / duration, 1);
		window.scrollTo({ top: fromY + distance * easeInOutCubic(progress), behavior: "instant" });
		if (progress < 1) frame = requestAnimationFrame(step);
		else stop();
	};
	cancelCurrent = stop;
	for (const type of INTERRUPT_EVENTS) window.addEventListener(type, stop, { passive: true });
	frame = requestAnimationFrame(step);
}
