import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from "react";

interface DropdownMotionOptions {
	elementRef: RefObject<HTMLDivElement | null>;
	open: boolean;
	onExitComplete: () => void;
	onReducedMotion: () => void;
}

const OPEN_DURATION = 220;
const CLOSE_DURATION = 140;
const REDUCED_DURATION = 100;
const OPEN_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

function stopAnimation(ref: RefObject<Animation | null>) {
	const animation = ref.current;
	ref.current = null;
	if (!animation) return;
	animation.onfinish = null;
	animation.cancel();
}

export const prefersReducedMotion = () =>
	window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * 浮出与退场：进入从触发器一侧 6px 处淡入，退出往回退 4px 并淡出，不缩放。
 * 关闭中重入、开启中收起都从元素当前的计算值续播，不经过起点或终点的帧。
 * 位移方向写在 CSS 变量里（跟随实际 data-side），关键帧引用变量，播放中碰撞翻转也沿新方位走而不重启。
 */
export function useDropdownMotion({
	elementRef,
	open,
	onExitComplete,
	onReducedMotion,
}: DropdownMotionOptions) {
	const openRef = useRef(open);
	openRef.current = open;
	const revealRef = useRef<Animation | null>(null);
	const fadeRef = useRef<Animation | null>(null);
	const cancel = useCallback(() => {
		stopAnimation(revealRef);
		stopAnimation(fadeRef);
	}, []);

	const reveal = useCallback(
		(next: boolean) => {
			stopAnimation(fadeRef);
			const element = elementRef.current;
			if (!element || typeof element.animate !== "function") {
				stopAnimation(revealRef);
				if (!next) onExitComplete();
				return;
			}
			const reduced = prefersReducedMotion();
			// 先读当前值再取消旧动画；首次展开没有旧动画，从隐藏态起步，首次收起从静止态起步
			const running = revealRef.current !== null;
			const styles = running ? getComputedStyle(element) : null;
			const rest = reduced ? "none" : "translate(0px, 0px)";
			const hidden = reduced ? "none" : "translate(0px, var(--v-dropdown-from-y))";
			const start = styles
				? { opacity: styles.opacity, transform: styles.transform }
				: next
					? { opacity: 0, transform: hidden }
					: { opacity: 1, transform: rest };
			stopAnimation(revealRef);
			const end = next
				? { opacity: 1, transform: rest }
				: {
						opacity: 0,
						transform: reduced ? "none" : "translate(0px, var(--v-dropdown-to-y))",
					};
			const animation = element.animate([start, end], {
				duration: reduced ? REDUCED_DURATION : next ? OPEN_DURATION : CLOSE_DURATION,
				easing: reduced ? "ease-out" : next ? OPEN_EASING : "ease-in",
				fill: "both",
			});
			revealRef.current = animation;
			animation.onfinish = () => {
				if (revealRef.current !== animation) return;
				if (!openRef.current) onExitComplete();
				else stopAnimation(revealRef);
			};
		},
		[elementRef, onExitComplete],
	);

	const fade = useCallback(() => {
		stopAnimation(revealRef);
		const element = elementRef.current;
		if (!element || typeof element.animate !== "function" || prefersReducedMotion()) {
			onExitComplete();
			return;
		}
		if (fadeRef.current) return;
		const animation = element.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: 90,
			fill: "both",
		});
		fadeRef.current = animation;
		animation.onfinish = () => {
			if (fadeRef.current === animation && !openRef.current) onExitComplete();
		};
	}, [elementRef, onExitComplete]);

	useLayoutEffect(() => cancel, [cancel]);
	useEffect(() => {
		const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
		const finish = () => {
			if (!media?.matches) return;
			cancel();
			onReducedMotion();
			if (!openRef.current) onExitComplete();
		};
		media?.addEventListener("change", finish);
		return () => media?.removeEventListener("change", finish);
	}, [cancel, onExitComplete, onReducedMotion]);

	return { reveal, fade, cancel };
}
