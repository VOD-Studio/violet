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

import type { Transition } from "motion/react";

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

/** 标准缓动曲线。 */
export const MOTION_EASE = {
	/** 长尾缓出：浮层与模态的主入场曲线（快起长收） */
	out: [0.16, 1, 0.3, 1] as const,
	/** 一般缓出：悬停、展开折叠、滚动显现 */
	softOut: [0.25, 0.46, 0.45, 0.94] as const,
	/** 抽屉标准曲线：移动端侧栏的确定性感 */
	drawer: [0.32, 0.72, 0, 1] as const,
	/** 离场加速：浮层与面板收回 */
	in: [0.4, 0, 1, 1] as const,
} as const;

/** 浮层由触发点浮现：fade + 缩放 + 方向微距（对应 Radix zoom-95 / slide-in-from-*）。 */
export const popoverEnter: Transition = {
	duration: MOTION_DURATION.enter,
	ease: MOTION_EASE.out,
};

/** 浮层收回：更快、加速离场。 */
export const popoverExit: Transition = {
	duration: MOTION_DURATION.exit,
	ease: MOTION_EASE.in,
};

/** 模态原地落座：fade + 上移归位 + 缩放归位，无方向语义。 */
export const modalEnter: Transition = {
	duration: MOTION_DURATION.modal,
	ease: MOTION_EASE.out,
};

/** 抽屉方向滑入：完整方向位移表达空间来源。 */
export const drawerEnter: Transition = {
	duration: MOTION_DURATION.drawerIn,
	ease: MOTION_EASE.drawer,
};

/** 抽屉方向滑出。 */
export const drawerExit: Transition = {
	duration: MOTION_DURATION.drawerOut,
	ease: MOTION_EASE.drawer,
};

/** 展开折叠：高度约束在 overflow-hidden 容器内完成。 */
export const collapseTransition: Transition = {
	duration: MOTION_DURATION.collapse,
	ease: MOTION_EASE.softOut,
};

/** 滚动显现：进入视口时淡入上移。 */
export const revealTransition: Transition = {
	duration: MOTION_DURATION.reveal,
	ease: MOTION_EASE.softOut,
};

/** 状态切换共享位移：layoutId 元素之间的流体过渡（如 Tab 胶囊）。 */
export const layoutTransition: Transition = {
	type: "spring",
	stiffness: 450,
	damping: 34,
};
