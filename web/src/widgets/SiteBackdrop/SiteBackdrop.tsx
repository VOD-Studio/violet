import { useReducedMotion } from "@shared/lib/motion";
import { useEffect, useRef } from "react";

import styles from "./SiteBackdrop.module.css";
import { useLifeCanvas } from "./useLifeCanvas";

/** 指针附近的点阵被主色点亮；仅精确指针且未要求减弱动态时启用。 */
function useLitGrid() {
	const litRef = useRef<HTMLDivElement>(null);
	const reduceMotion = useReducedMotion();

	useEffect(() => {
		const lit = litRef.current;
		if (!lit || reduceMotion) return undefined;
		if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return undefined;

		let radius = lit.offsetWidth / 2;
		let frame = 0;
		let x = 0;
		let y = 0;

		const paint = () => {
			frame = 0;
			// 点阵与遮罩都按视口原点对齐，元素跟随指针时反向偏移背景，点位才与底层网格重合
			const offset = `${radius - x}px ${radius - y}px`;
			lit.style.transform = `translate3d(${x - radius}px, ${y - radius}px, 0)`;
			lit.style.backgroundPosition = offset;
			lit.style.maskPosition = `0 0, ${offset}`;
		};
		const handleMove = (event: PointerEvent) => {
			if (event.pointerType !== "mouse") return;
			x = event.clientX;
			y = event.clientY;
			lit.dataset.active = "";
			if (!frame) frame = requestAnimationFrame(paint);
		};
		const handleLeave = () => {
			delete lit.dataset.active;
		};
		const handleResize = () => {
			radius = lit.offsetWidth / 2;
		};

		const root = document.documentElement;
		window.addEventListener("pointermove", handleMove, { passive: true });
		window.addEventListener("resize", handleResize);
		window.addEventListener("blur", handleLeave);
		root.addEventListener("pointerleave", handleLeave);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("pointermove", handleMove);
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("blur", handleLeave);
			root.removeEventListener("pointerleave", handleLeave);
			handleLeave();
		};
	}, [reduceMotion]);

	return litRef;
}

/**
 * 前台固定背景点缀「网点纸」：边缘点阵、角落天光与在点阵上演化的生命游戏，不随页面滚动。
 *
 * @remarks 须挂在建立层叠上下文（isolate）的前台壳层内：负 z-index 让它位于壳层画布之上、
 * 页面内容之下；不透明的卡片与页脚自然遮住它。
 */
export default function SiteBackdrop() {
	const litRef = useLitGrid();
	const lifeRef = useLifeCanvas();

	return (
		<div aria-hidden className={styles.backdrop}>
			<div className={`${styles.wash} ${styles.washSky}`} />
			<div className={`${styles.wash} ${styles.washEmber}`} />
			<div className={styles.grid} />
			<canvas ref={lifeRef} className={styles.life} />
			<div ref={litRef} className={styles.lit} />
			<div className={styles.grain} />
		</div>
	);
}
