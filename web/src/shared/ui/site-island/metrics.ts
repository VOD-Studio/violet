/** 收起时常驻的主要入口，其余收进「更多」展开的面板 */
export const PRIMARY_TAB_COUNT = 4;
/** 槽位数：主要入口加「更多」 */
export const SLOT_COUNT = PRIMARY_TAB_COUNT + 1;
export const COLLAPSED_HEIGHT = 52;
export const EXPANDED_MAX_WIDTH = 400;
export const SIDE_GAP = 16;
export const TRACK_PADDING = 4;
export const COMPACT_SIZE = 44;
/** 活动胶囊左右内边距之和 */
export const PILL_PADDING = 28;
/** 胶囊为全圆；展开成面板后收到功能性圆角上限 */
export const EXPANDED_RADIUS = 16;
export const ROW_HEIGHT = COLLAPSED_HEIGHT - TRACK_PADDING * 2;

export const SPRING = { type: "spring", stiffness: 340, damping: 32, mass: 0.9 } as const;
export const BLUR_OUT = { opacity: 0, filter: "blur(6px)" };
export const BLUR_IN = { opacity: 1, filter: "blur(0px)" };

/** 阻尼弹簧在 `seconds` 秒时的进度（0.48 秒收敛）。 */
export function springProgress(seconds: number): number {
	if (seconds <= 0) return 0;
	if (seconds >= 0.48) return 1;
	const frequency = Math.sqrt(96);
	return (
		1 -
		Math.exp(-18 * seconds) *
			(Math.cos(frequency * seconds) + (18 / frequency) * Math.sin(frequency * seconds))
	);
}

const SLIDE_EASING = `linear(${Array.from({ length: 30 }, (_, index) =>
	springProgress((index / 29) * 0.48),
).join(",")})`;
export const SLIDE_TRANSITION = `transform 480ms ${SLIDE_EASING}`;
