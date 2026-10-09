import { CLOSE, CUBIC, type Drawing, type InkBatch, LINE, MOVE, type Path } from "../core/types.ts";
import { type Palette, paint, type RenderOptions } from "./palette.ts";

const batchPaths = new WeakMap<InkBatch, Path2D>();
const clipPaths = new WeakMap<Path, Path2D>();

function toPath2D(verbs: ArrayLike<number>, coords: ArrayLike<number>): Path2D {
	const path = new Path2D();
	let c = 0;
	for (let i = 0; i < verbs.length; i++) {
		const verb = verbs[i];
		if (verb === MOVE) path.moveTo(coords[c++], coords[c++]);
		else if (verb === LINE) path.lineTo(coords[c++], coords[c++]);
		else if (verb === CUBIC) {
			path.bezierCurveTo(
				coords[c],
				coords[c + 1],
				coords[c + 2],
				coords[c + 3],
				coords[c + 4],
				coords[c + 5],
			);
			c += 6;
		} else if (verb === CLOSE) path.closePath();
	}
	return path;
}

function cached<K extends object>(map: WeakMap<K, Path2D>, key: K, build: () => Path2D): Path2D {
	let path = map.get(key);
	if (!path) {
		path = build();
		map.set(key, path);
	}
	return path;
}

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
	options: RenderOptions = {},
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
	if (!ctx) throw new Error("Canvas 2D 不可用");
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, width, height);
	const background = options.background === undefined ? "paper" : options.background;
	if (background) {
		ctx.fillStyle = paint(palette, background);
		ctx.fillRect(0, 0, width, height);
	}
	const scale = Math.min(width / drawing.width, height / drawing.height);
	ctx.setTransform(
		scale,
		0,
		0,
		scale,
		(width - drawing.width * scale) / 2,
		(height - drawing.height * scale) / 2,
	);
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	for (const item of drawing.items) {
		ctx.save();
		if (item.transform) ctx.transform(...item.transform);
		for (const batch of item.batches) {
			ctx.save();
			ctx.globalAlpha = batch.opacity ?? 1;
			if (batch.clip) {
				const clip = batch.clip;
				ctx.clip(
					cached(clipPaths, clip, () => toPath2D(clip.verbs, clip.coords)),
					clip.fillRule,
				);
			}
			const path = cached(batchPaths, batch, () => toPath2D(batch.verbs, batch.coords));
			const color = paint(palette, batch.role);
			if (batch.mode === "fill") {
				ctx.fillStyle = color;
				ctx.fill(path, batch.fillRule ?? "nonzero");
			} else {
				ctx.strokeStyle = color;
				ctx.lineWidth = batch.width ?? 1;
				ctx.stroke(path);
			}
			ctx.restore();
		}
		if (item.label) {
			ctx.fillStyle = paint(palette, "ink");
			ctx.font = `${item.label.size ?? 14}px ${options.fontFamily ?? "system-ui, sans-serif"}`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(item.label.text, item.label.x, item.label.y);
		}
		ctx.restore();
	}
}

export type { Palette, RenderOptions } from "./palette.ts";
