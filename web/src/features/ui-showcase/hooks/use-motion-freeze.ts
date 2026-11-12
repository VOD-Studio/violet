import { type RefObject, useEffect } from "react";

/**
 * 在容器内模拟减弱动态：CSS 动画与过渡由样式关闭，脚本动画每帧直接跳到终点。
 *
 * @remarks 无限循环的脚本动画没有终点，直接取消；容器外（Portal）的动画不受影响。
 */
export function useMotionFreeze(ref: RefObject<HTMLElement | null>, enabled: boolean) {
	useEffect(() => {
		const element = ref.current;
		if (!enabled || !element) return;
		let frame = 0;
		const settle = () => {
			for (const animation of element.getAnimations({ subtree: true })) {
				if (animation instanceof CSSAnimation || animation instanceof CSSTransition)
					continue;
				if (animation.playState === "finished") continue;
				const end = animation.effect?.getComputedTiming().endTime;
				if (end === undefined || end === Number.POSITIVE_INFINITY) animation.cancel();
				else animation.finish();
			}
			frame = requestAnimationFrame(settle);
		};
		settle();
		return () => cancelAnimationFrame(frame);
	}, [ref, enabled]);
}
