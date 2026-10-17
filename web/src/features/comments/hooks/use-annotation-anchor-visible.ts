import { useLayoutEffect, useState } from "react";

/** 只判断正文锚点是否可见，不因内部滚动关闭会话或卸载草稿。 */
export function useAnnotationAnchorVisible(
	anchor: HTMLElement | null | undefined,
	enabled: boolean,
): boolean {
	const [visible, setVisible] = useState(true);
	useLayoutEffect(() => {
		if (!enabled || !anchor) return;
		let frame = 0;
		const measure = () => {
			frame = 0;
			const rect = anchor.getBoundingClientRect();
			setVisible(anchor.isConnected && rect.bottom >= 0 && rect.top <= window.innerHeight);
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(measure);
		};
		measure();
		window.addEventListener("scroll", schedule, { passive: true, capture: true });
		window.addEventListener("resize", schedule);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", schedule, { capture: true });
			window.removeEventListener("resize", schedule);
		};
	}, [anchor, enabled]);
	return visible;
}
