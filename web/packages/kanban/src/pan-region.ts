/** 看板在等触屏长按（尚未判定是拖卡片还是滑动）时，根节点上的标记：画布此时不抢这根手指。 */
export const HOLD_PENDING_ATTRIBUTE = "data-kanban-holding";

/** 画布视口上的标记：里面的看板据此知道自己在可平移的区域里。 */
export const PAN_REGION_SELECTOR = "[data-kanban-pan-region]";

/** 看板请求外层画布平移时发出的事件。 */
export const PAN_EVENT = "kanban-pan";

/** 看板里的用户开始编辑（拖拽）时发出的事件。 */
export const EDITING_EVENT = "kanban-editing";

/** `PAN_EVENT` 的 `detail`：屏幕 px，正方向为内容向右、向下。 */
export interface PanRequest {
	dx: number;
	dy: number;
}

/**
 * 请求包含 `from` 的画布平移；画布在事件派发返回前就已把画面更新到位。
 *
 * @returns 画布是否真的移动了；没有画布，或已经到内容尽头时为 false
 */
export function requestPan(from: Element, dx: number, dy: number): boolean {
	const event = new CustomEvent<PanRequest>(PAN_EVENT, {
		bubbles: true,
		cancelable: true,
		detail: { dx, dy },
	});
	from.dispatchEvent(event);
	return event.defaultPrevented;
}

/** 告知包含 `from` 的画布：用户开始在里面的看板上编辑，画布不应再随内容尺寸变化重新适应。 */
export function notifyEditing(from: Element) {
	from.dispatchEvent(new CustomEvent(EDITING_EVENT, { bubbles: true }));
}
