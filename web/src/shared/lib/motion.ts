/**
 * 全站动效法定 token：时长、缓动与各交互场景的 Transition 预设。
 *
 * 四职责（详见营造法式「动效章程」章）：反馈、浮现、流动、氛围。
 * 三条律法贯穿所有场景：
 * 1. 合成层律：只动 transform / opacity / paint-only 颜色，
 *    禁止动画 layout 属性（width/height/margin/top/left）引发布局抖动；
 * 2. 场景律：运动形态由空间语义决定——模态原地落座、浮层自触发点浮现、
 *    抽屉自屏幕边缘进出、链接线沿阅读方向生长；
 * 3. 快进快出律：入场温和 ease-out，离场更快（约七成时长）；
 *    一切动效尊重 prefers-reduced-motion 降级为直接呈现。
 */

import { type RefObject, useEffect, useState } from "react";

/** 标准时长基准（秒）。 */
export const MOTION_DURATION = {
	/** 按压与快速反馈 */
	press: 0.12,
	/** 链接线条与悬停反馈 */
	hover: 0.18,
	/** 浮层气泡与弹出游层入场 */
	enter: 0.2,
	/** 浮层离场：比入场更快 */
	exit: 0.15,
	/** 模态对话框内容落座 */
	modal: 0.24,
	/** 抽屉滑入 */
	drawerIn: 0.3,
	/** 抽屉滑出：比滑入更快 */
	drawerOut: 0.25,
	/** 展开折叠面板 */
	collapse: 0.22,
	/** 滚动显现：进入视口 */
	reveal: 0.5,
} as const;

/** 标准缓动曲线数值（cubic-bezier 参数四元组）。 */
export const MOTION_EASE = {
	/** 长尾缓出：浮层与模态的主入场曲线（快起长收） */
	out: [0.16, 1, 0.3, 1] as const,
	/** 一般缓出：悬停、展开折叠、滚动显现 */
	softOut: [0.25, 0.46, 0.45, 0.94] as const,
	/** 抽屉标准曲线：移动端侧栏的确定性感 */
	drawer: [0.32, 0.72, 0, 1] as const,
	/** 离场加速：浮层与面板收回 */
	in: [0.4, 0, 1, 1] as const,
	/** 弹韧曲线：磁吸与微弹反馈 */
	spring: [0.175, 0.885, 0.32, 1.275] as const,
} as const;

/** 原生 CSS cubic-bezier 缓动字符串，便于直接内联至 style/className。 */
export const MOTION_BEZIER = {
	out: `cubic-bezier(${MOTION_EASE.out.join(", ")})`,
	softOut: `cubic-bezier(${MOTION_EASE.softOut.join(", ")})`,
	drawer: `cubic-bezier(${MOTION_EASE.drawer.join(", ")})`,
	in: `cubic-bezier(${MOTION_EASE.in.join(", ")})`,
	spring: `cubic-bezier(${MOTION_EASE.spring.join(", ")})`,
} as const;

/**
 * 监听用户系统是否启用了 prefers-reduced-motion。
 * 纯原生实现，不引入任何三方动画库运行时。
 */
export function useReducedMotion(): boolean {
	const [reduced, setReduced] = useState(() => {
		if (typeof window === "undefined" || !window.matchMedia) return false;
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	});

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return undefined;
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const handler = () => setReduced(media.matches);
		media.addEventListener("change", handler);
		return () => media.removeEventListener("change", handler);
	}, []);

	return reduced;
}

/**
 * 视口进入检测 Hook：基于原生 IntersectionObserver。
 * 默认 once = true 进入触发一次。
 */
export function useInView(
	ref: RefObject<HTMLElement | null>,
	options?: { once?: boolean; margin?: string },
): boolean {
	const [inView, setInView] = useState(false);

	useEffect(() => {
		const target = ref.current;
		if (!target || typeof IntersectionObserver === "undefined") {
			setInView(true);
			return undefined;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setInView(true);
					if (options?.once ?? true) {
						observer.disconnect();
					}
				} else if (!options?.once) {
					setInView(false);
				}
			},
			{ rootMargin: options?.margin ?? "-40px" },
		);

		observer.observe(target);
		return () => observer.disconnect();
	}, [ref, options?.once, options?.margin]);

	return inView;
}
