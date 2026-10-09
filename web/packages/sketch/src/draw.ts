import { flatten } from "./core/flatten.ts";
import { BatchBuilder } from "./core/ir.ts";
import { channel, createRandom, hashString, type RandomSource } from "./core/rng.ts";
import type {
	DrawContext,
	Drawing,
	DrawnItem,
	DrawOptions,
	InkBatch,
	Scene,
	SceneItem,
	Stroke,
} from "./core/types.ts";
import { solidFill } from "./fill/patterns.ts";

const FILL_SCOPE = channel("sketch:scope:fill");
// 描边结束到开始填充之间的停顿，与笔画时间同为弧长单位。
const FILL_PAUSE = 40;

/**
 * 输出超过调用方指定的预算；生成中止，不返回部分结果。
 *
 * @remarks actual 为首次检测到超限时的累计值，不是完整场景所需总量。
 */
export class BudgetExceeded extends Error {
	readonly kind: "vertices" | "strokes";
	readonly actual: number;
	readonly limit: number;

	constructor(kind: "vertices" | "strokes", actual: number, limit: number) {
		super(
			`${kind === "vertices" ? "输出顶点" : "笔画"}超限：${actual} / ${limit}；未自动降低质量`,
		);
		this.name = "BudgetExceeded";
		this.kind = kind;
		this.actual = actual;
		this.limit = limit;
	}
}

function lastTime(strokes: readonly Stroke[]): number {
	let t = 0;
	for (const stroke of strokes) {
		const p = stroke.points;
		if (p.length) t = Math.max(t, p[p.length - 1]);
	}
	return t;
}

// 笔返回的批次归生成器所有（见 Pen.ink），就地归一化以免再复制一份 spans。
function retime(batch: InkBatch, offset: number, total: number): InkBatch {
	const spans = batch.spans as Float32Array;
	for (let i = 0; i < spans.length; i++) spans[i] = (spans[i] + offset) / total;
	return batch;
}

/**
 * 按场景顺序生成全部图元的笔墨，返回可被多个后端重复渲染的结果。
 *
 * @throws {@link BudgetExceeded} 当输出顶点或笔画数超过预算。
 * @remarks 扩展抛出的异常直接传播，不返回部分场景；颜色只以角色记录，换色无需重新生成。
 *
 * @example
 * ```ts
 * import { draw, rect, styles } from "@violet/sketch";
 *
 * const drawing = draw(
 *   { width: 160, height: 100, items: [{ id: "card", path: rect(10, 10, 140, 80, 8), fillRole: "surface" }] },
 *   { style: styles.natural, seed: 35 },
 * );
 * ```
 */
export function draw(scene: Scene, options: DrawOptions): Drawing {
	const started = performance.now();
	const seed = options.seed ?? 1;
	const width = options.width ?? 2;
	const precision = options.precision ?? 0.25;
	const pixelScale = options.pixelScale ?? 1;
	const maxVertices = options.maxVertices ?? 2_000_000;
	const maxStrokes = options.maxStrokes ?? 200_000;
	let vertices = 0;
	let strokeCount = 0;

	const context = (random: RandomSource, w: number, pinEnds: boolean): DrawContext => ({
		...random,
		width: w,
		precision,
		pixelScale,
		pinEnds,
		flatten: (path) => flatten(path, precision),
	});

	const drawItem = (item: SceneItem): DrawnItem => {
		const style = item.style ?? options.style;
		const random = createRandom(seed, hashString(item.id));
		const ctx = context(random, width, item.pinEnds ?? false);
		const skeleton = flatten(item.path, precision);
		const strokeRole = item.strokeRole ?? "ink";

		const outline = strokeRole === "none" ? [] : style.hand.strokes(skeleton, ctx);
		const outlineEnd = lastTime(outline);

		const fillBatches: InkBatch[] = [];
		let fillStrokes: readonly Stroke[] = [];
		const fillStart = outline.length ? outlineEnd + FILL_PAUSE : 0;
		let fillEnd = fillStart;
		if (item.fillRole && skeleton.contours.some((c) => c.closed)) {
			const fillCtx = context(
				random.scope(FILL_SCOPE),
				width * (style.fillWeight ?? 0.5),
				false,
			);
			const output = (style.fill ?? solidFill).generate(skeleton, fillCtx, item.path);
			if (output.guides) {
				fillStrokes = (style.fillHand ?? style.hand).strokes(output.guides, fillCtx);
				fillEnd = fillStart + lastTime(fillStrokes);
			}
			if (output.areas?.length) {
				// 实色区域与图案笔画共用填充时段；没有图案时给出与描边相称的时长。
				if (fillEnd === fillStart) fillEnd = fillStart + Math.max(outlineEnd * 0.25, 1);
				const area = new BatchBuilder({
					mode: "fill",
					role: item.fillRole,
					fillRule: item.path.fillRule,
				});
				for (const path of output.areas) area.path(path, fillStart, fillEnd);
				fillBatches.push(area.build());
			}
			for (const batch of (style.fillPen ?? style.pen).ink(
				fillStrokes,
				fillCtx,
				item.fillRole,
			))
				fillBatches.push({ ...batch, clip: item.path });
		}

		// 实色区域的 spans 已是绝对时间；填充笔画的时间从 0 起算，需平移到填充时段。
		const total = Math.max(fillEnd, outlineEnd, 1e-9);
		const batches: InkBatch[] = [];
		for (const batch of fillBatches)
			batches.push(retime(batch, batch.clip ? fillStart : 0, total));
		for (const batch of style.pen.ink(outline, ctx, strokeRole))
			batches.push(retime(batch, 0, total));

		strokeCount += outline.length + fillStrokes.length;
		if (strokeCount > maxStrokes) throw new BudgetExceeded("strokes", strokeCount, maxStrokes);
		for (const batch of batches) vertices += batch.coords.length / 2;
		if (vertices > maxVertices) throw new BudgetExceeded("vertices", vertices, maxVertices);

		return { id: item.id, batches, transform: item.transform, label: item.label };
	};

	const items = scene.items.map(drawItem);
	return {
		width: scene.width,
		height: scene.height,
		items,
		seed,
		budget: { vertices, strokes: strokeCount },
		generateMs: performance.now() - started,
	};
}
