import { sampleGeometry } from "../geometry.ts";
import type { DrawnScene, Geometry, Palette } from "../types.ts";
import { paintColor } from "./palette.ts";

const canvasModels = new WeakMap<
	HTMLCanvasElement,
	{ drawn: DrawnScene; paths: Map<Geometry, Path2D> }
>();

function revealClip(
	context: CanvasRenderingContext2D,
	geometry: Geometry,
	width: number,
	progress: number,
): void {
	const contours = sampleGeometry(geometry, 4, 0.3);
	const radius = width / 2;
	context.beginPath();
	for (const contour of contours) {
		const points = contour.points;
		if (!points.length) continue;
		const target = contour.length * progress;
		context.moveTo(points[0].x + radius, points[0].y);
		context.arc(points[0].x, points[0].y, radius, 0, Math.PI * 2);
		context.closePath();
		for (let i = 1; i < points.length && points[i - 1].s < target; i++) {
			const a = points[i - 1],
				b = points[i];
			const fraction = b.s === a.s ? 1 : Math.min(1, (target - a.s) / (b.s - a.s));
			const ex = a.x + (b.x - a.x) * fraction,
				ey = a.y + (b.y - a.y) * fraction;
			const dx = ex - a.x,
				dy = ey - a.y,
				length = Math.hypot(dx, dy);
			if (length) {
				const nx = (-dy * radius) / length,
					ny = (dx * radius) / length;
				context.moveTo(a.x + nx, a.y + ny);
				context.lineTo(a.x - nx, a.y - ny);
				context.lineTo(ex - nx, ey - ny);
				context.lineTo(ex + nx, ey + ny);
				context.closePath();
			}
			context.moveTo(ex + radius, ey);
			context.arc(ex, ey, radius, 0, Math.PI * 2);
			context.closePath();
		}
	}
	context.clip("nonzero");
}

/**
 * 清空画布后重放生成结果，并按实际 CSS 尺寸和设备 DPR 调整像素尺寸。
 *
 * @param canvas - 浏览器 HTMLCanvasElement；当前实现依赖 window 与 getBoundingClientRect。
 * @param palette - 包含所有图层角色及 paper/ink 的 CSS 配色。
 * @param progress - 归一化显现进度；只重绘已有笔墨，不调用 Pen.generate。
 * @param sequential - true 按图元数量均分进度；false 让各图元并行显现。
 * @throws 当 Canvas 2D 不可用或颜色角色缺失。
 * @remarks Path2D 缓存由画布与 drawn 对象身份决定；更换结果会替换缓存。
 * 调用返回仅代表绘制指令已提交，不代表像素已呈现。
 */
export function drawCanvas(
	drawn: DrawnScene,
	canvas: HTMLCanvasElement,
	palette: Palette,
	progress = 1,
	sequential = false,
): void {
	const bounds = canvas.getBoundingClientRect();
	const cssWidth = bounds.width || drawn.width;
	const cssHeight = bounds.height || (cssWidth * drawn.height) / drawn.width;
	const dpr = window.devicePixelRatio;
	const width = Math.max(1, Math.round(cssWidth * dpr)),
		height = Math.max(1, Math.round(cssHeight * dpr));
	if (canvas.width !== width) canvas.width = width;
	if (canvas.height !== height) canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas 2D 不可用");
	let model = canvasModels.get(canvas);
	if (!model || model.drawn !== drawn) {
		model = { drawn, paths: new Map<Geometry, Path2D>() };
		canvasModels.set(canvas, model);
	}
	const paths = model.paths;
	const path = (g: Geometry) => {
		let p = paths.get(g);
		if (!p) {
			p = new Path2D(g.d);
			paths.set(g, p);
		}
		return p;
	};
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.clearRect(0, 0, width, height);
	context.fillStyle = paintColor(palette, "paper");
	context.fillRect(0, 0, width, height);
	const scale = Math.min(width / drawn.width, height / drawn.height);
	context.setTransform(
		scale,
		0,
		0,
		scale,
		(width - drawn.width * scale) / 2,
		(height - drawn.height * scale) / 2,
	);
	for (let i = 0; i < drawn.items.length; i++) {
		const item = drawn.items[i];
		const p = Math.max(
			0,
			Math.min(1, sequential ? progress * drawn.items.length - i : progress),
		);
		if (p <= 0) continue;
		context.save();
		if (item.transform) context.transform(...item.transform);
		for (const layer of item.layers) {
			context.save();
			context.globalAlpha = (layer.opacity ?? 1) * (layer.reveal ? 1 : p);
			if (layer.clip) context.clip(path(layer.clip), layer.clip.fillRule);
			if (layer.reveal && p < 1)
				revealClip(context, layer.reveal, layer.revealWidth ?? 20, p);
			if (layer.mode === "fill") {
				context.fillStyle = paintColor(palette, layer.role);
				context.fill(path(layer.geometry), layer.geometry.fillRule);
			} else {
				context.strokeStyle = paintColor(palette, layer.role);
				context.lineWidth = layer.width ?? 1;
				context.lineCap = "round";
				context.lineJoin = "round";
				context.stroke(path(layer.geometry));
			}
			context.restore();
		}
		if (item.label) {
			context.globalAlpha = p;
			context.fillStyle = paintColor(palette, "ink");
			context.font = `${item.label.size ?? 14}px Arial`;
			context.textAlign = "center";
			context.textBaseline = "middle";
			context.fillText(item.label.text, item.label.x, item.label.y);
		}
		context.restore();
	}
}
