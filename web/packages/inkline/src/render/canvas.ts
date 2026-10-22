import type { Drawing } from "../core/types.ts";
import { type CanvasOptions, paintFrame } from "./paint.ts";
import type { Palette } from "./palette.ts";

/**
 * 清空画布并绘制生成结果；按画布 CSS 尺寸与设备 DPR 调整像素尺寸，等比居中。
 *
 * @throws 当 Canvas 2D 不可用或 palette 缺少颜色角色。
 * @remarks Path2D 按批次对象缓存，重复绘制同一结果不重建路径。
 */
export function drawCanvas(
	drawing: Drawing,
	canvas: HTMLCanvasElement,
	palette: Palette,
	options: CanvasOptions = {},
): void {
	const bounds = canvas.getBoundingClientRect();
	const cssWidth = bounds.width || drawing.width;
	const cssHeight = bounds.height || (cssWidth * drawing.height) / drawing.width;
	const dpr = window.devicePixelRatio || 1;
	const width = Math.max(1, Math.round(cssWidth * dpr));
	const height = Math.max(1, Math.round(cssHeight * dpr));
	if (canvas.width !== width) canvas.width = width;
	if (canvas.height !== height) canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("The canvas has no 2D context.");
	paintFrame(ctx, drawing, palette, width, height, options);
}

export type { CanvasOptions } from "./paint.ts";
export type { Palette, RenderOptions } from "./palette.ts";
