import { useEffect, useState } from "react";

/** 等待超过 200ms 才显示指示器。 */
export const DELAY_SHOW_MS = 200;
/** 显示后至少停留 400ms，避免闪烁。 */
export const MIN_VISIBLE_MS = 400;

/**
 * 延迟显示的忙碌状态：`busy` 为 true 超过 200ms 才置 `show`，且一旦显示至少停留 400ms。
 *
 * @remarks 延迟只作用于视觉：`aria-busy` 与禁用应由调用方绑定 `busy` 立即生效，
 * 不经此 hook。
 * @param busy - 实际忙碌中
 * @returns `show`：是否显示指示器
 *
 * @example
 * ```tsx
 * const show = useDelayedBusy(pending);
 * <button type="submit" aria-busy={pending} disabled={pending}>
 *   {show && <Spinner aria-hidden />}<span>保存</span>
 * </button>
 * ```
 */
export function useDelayedBusy(busy: boolean): boolean {
	const [show, setShow] = useState(false);

	useEffect(() => {
		if (busy) {
			// 200ms 内完成的不显示任何加载
			const showTimer = window.setTimeout(() => setShow(true), DELAY_SHOW_MS);
			return () => window.clearTimeout(showTimer);
		}
		setShow((visible) => visible);
		return undefined;
	}, [busy]);

	// 从显示切回空闲时保底停留 400ms
	useEffect(() => {
		if (show && !busy) {
			const hideTimer = window.setTimeout(() => setShow(false), MIN_VISIBLE_MS);
			return () => window.clearTimeout(hideTimer);
		}
		return undefined;
	}, [show, busy]);

	return show;
}
