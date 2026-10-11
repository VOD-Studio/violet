import { useEffect, useState } from "react";

/**
 * 控制进出场动画的挂载时机：open 变 true 先挂载，下一帧再置 visible 触发过渡；
 * open 变 false 先置 visible=false 播放离场，exitMs 后才卸载。
 *
 * @param exitMs - 离场过渡时长，需不小于 CSS 中的 transition 时长
 */
export function usePresence(open: boolean, exitMs: number): { mounted: boolean; visible: boolean } {
	const [mounted, setMounted] = useState(open);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (open) {
			setMounted(true);
			let inner = 0;
			const outer = requestAnimationFrame(() => {
				inner = requestAnimationFrame(() => setVisible(true));
			});
			return () => {
				cancelAnimationFrame(outer);
				cancelAnimationFrame(inner);
			};
		}
		setVisible(false);
		const timer = window.setTimeout(() => setMounted(false), exitMs);
		return () => clearTimeout(timer);
	}, [open, exitMs]);

	return { mounted, visible };
}
