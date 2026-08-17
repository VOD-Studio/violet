import { type MouseEvent, useCallback } from "react";

/** 磁性吸附计算入参 */
export interface MagneticInput {
	/** 鼠标相对视口 X 坐标 */
	clientX: number;
	/** 鼠标相对视口 Y 坐标 */
	clientY: number;
	/** 元素中心点视口 X 坐标 */
	cx: number;
	/** 元素中心点视口 Y 坐标 */
	cy: number;
	/** 吸附强度（0..1，1 表示完全跟随鼠标），默认 0.25 */
	strength?: number;
}

/** 磁性吸附位移偏移量（px） */
export interface MagneticOffset {
	/** X 轴偏移（px） */
	dx: number;
	/** Y 轴偏移（px） */
	dy: number;
}

/**
 * 根据鼠标位置与元素中心计算磁性吸附偏移量（纯函数）。
 *
 * @param input - 坐标与强度入参
 * @returns X/Y 轴偏移像素值
 */
export function computeMagnetic(input: MagneticInput): MagneticOffset {
	const { clientX, clientY, cx, cy, strength = 0.25 } = input;
	return {
		dx: (clientX - cx) * strength,
		dy: (clientY - cy) * strength,
	};
}

/**
 * 为元素绑定鼠标移动与离开事件，通过 CSS 变量 `--mx` / `--my` 输出磁性吸附偏移。
 *
 * @param strength - 吸附强度（0..1），默认 0.25
 *
 * @returns 包含 `onMouseMove` 与 `onMouseLeave` 事件处理器的对象
 *
 * @example
 * ```tsx
 * const { onMouseMove, onMouseLeave } = useMagnetic(0.3);
 * return <button onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} />;
 * ```
 */
export function useMagnetic(strength = 0.25) {
	const onMouseMove = useCallback(
		(e: MouseEvent<HTMLElement>) => {
			const el = e.currentTarget;
			const r = el.getBoundingClientRect();
			const off = computeMagnetic({
				clientX: e.clientX,
				clientY: e.clientY,
				cx: r.left + r.width / 2,
				cy: r.top + r.height / 2,
				strength,
			});
			el.style.setProperty("--mx", `${off.dx}px`);
			el.style.setProperty("--my", `${off.dy}px`);
		},
		[strength],
	);
	const onMouseLeave = useCallback((e: MouseEvent<HTMLElement>) => {
		const el = e.currentTarget;
		el.style.setProperty("--mx", "0px");
		el.style.setProperty("--my", "0px");
	}, []);
	return { onMouseMove, onMouseLeave };
}
