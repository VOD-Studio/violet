import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from "react";

interface DropdownMotionOptions {
	elementRef: RefObject<HTMLDivElement | null>;
	open: boolean;
	onExitComplete: () => void;
	onReducedMotion: () => void;
}

const OPEN_DURATION = 260;
const CLOSE_DURATION = 180;

function stopAnimation(ref: RefObject<Animation | null>) {
	const animation = ref.current;
	ref.current = null;
	if (!animation) return;
	animation.onfinish = null;
	animation.cancel();
}

export const prefersReducedMotion = () =>
	window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** 裁剪动画反向续播；只有当前关闭动画完成后才释放面板。 */
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
			if (!element || typeof element.animate !== "function" || prefersReducedMotion()) {
				stopAnimation(revealRef);
				if (!next) onExitComplete();
				return;
			}
			let animation = revealRef.current;
			if (!animation) {
				const styles = getComputedStyle(element);
				animation = element.animate(
					[
						{ clipPath: "var(--v-dropdown-collapsed-clip)" },
						{ clipPath: styles.clipPath },
					],
					{ duration: OPEN_DURATION, easing: "ease-in-out", fill: "both" },
				);
				animation.currentTime = next ? 0 : OPEN_DURATION;
				revealRef.current = animation;
				const current = animation;
				current.onfinish = () => {
					if (revealRef.current !== current) return;
					if (!openRef.current) onExitComplete();
					else stopAnimation(revealRef);
				};
			}
			animation.updatePlaybackRate(next ? 1 : -OPEN_DURATION / CLOSE_DURATION);
			animation.play();
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
