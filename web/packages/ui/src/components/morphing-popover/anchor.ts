import type { Box } from "./morph";

/** 面板固定触发器的哪个角：竖向在前，横向在后；朝对角方向长。 */
export type Anchor = "top left" | "top right" | "bottom left" | "bottom right";

/** 面板离视口边缘至少留的空隙。 */
export const VIEWPORT_MARGIN = 8;

/**
 * 沿一条轴选固定触发器的哪一端：能朝正向长就朝正向，不行换反向，两边都放不下取空间大的一侧。
 * `outset` 是面板的角比触发器的角外扩的距离，占用的空间要算进去。
 */
function pick(start: number, end: number, length: number, limit: number, outset: number) {
	if (start - outset + length <= limit - VIEWPORT_MARGIN) {
		return "start";
	}
	if (end + outset - length >= VIEWPORT_MARGIN) {
		return "end";
	}
	return limit - (start - outset) >= end + outset ? "start" : "end";
}

/** 接力时保留横向锚点；原竖向放不下新面板时改朝有空间的一侧长。 */
export function chooseAnchor(
	trigger: Box,
	panel: { width: number; height: number },
	viewport: { width: number; height: number },
	outset: number,
	previous?: Anchor,
): Anchor {
	let y = pick(trigger.top, trigger.top + trigger.height, panel.height, viewport.height, outset);
	let x: "start" | "end";
	if (previous) {
		x = previous.endsWith("left") ? "start" : "end";
		const top = trigger.top - outset;
		const bottom = trigger.top + trigger.height + outset;
		if (previous.startsWith("top") && top + panel.height <= viewport.height - VIEWPORT_MARGIN) {
			y = "start";
		} else if (previous.startsWith("bottom") && bottom - panel.height >= VIEWPORT_MARGIN) {
			y = "end";
		}
	} else {
		x = pick(trigger.left, trigger.left + trigger.width, panel.width, viewport.width, outset);
	}
	return `${y === "start" ? "top" : "bottom"} ${x === "start" ? "left" : "right"}`;
}
