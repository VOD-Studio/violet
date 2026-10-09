import { sampleGeometry } from "./geometry.ts";
import type {
	Budget,
	DrawnItem,
	DrawnScene,
	GenerateOptions,
	InkLayer,
	Pen,
	PenContext,
	Scene,
} from "./types.ts";

/**
 * 表示一次生成已超过调用方指定的命令或采样预算。
 *
 * @remarks actual 是首次检测到超限时的累计值，不是完成整幅图所需的总量。
 */
export class BudgetExceeded extends Error {
	constructor(
		public readonly kind: "commands" | "samples",
		public readonly actual: number,
		public readonly limit: number,
	) {
		super(
			`${kind === "commands" ? "矢量命令" : "采样点"}超限：${actual} / ${limit}；未自动降低质量`,
		);
		this.name = "BudgetExceeded";
	}
}

function hash(value: string): number {
	let n = 2166136261;
	for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619);
	return n >>> 0;
}

/**
 * 按场景顺序生成填充和笔迹，返回可供多个后端重复绘制的完整结果。
 *
 * @param scene - 图元 id 应唯一且稳定；生成期间不得修改场景及其几何。
 * @param pen - 所有非 none 描边共用的算法；笔迹专属参数由算法工厂配置。
 * @returns 不含后端对象的笔墨结果；耗时仅覆盖本次同步生成。
 * @throws {@link BudgetExceeded} 当命令或采样工作量超过指定预算。
 * @remarks 算法异常直接传播，不返回部分场景；重复生成仍执行笔迹算法，只有骨架采样可命中缓存。
 *
 * @example
 * ```ts
 * import { createNaturalPen, generateScene, rectangleGeometry } from "@violet/sketch";
 *
 * const drawn = generateScene(
 *   { width: 160, height: 100, items: [
 *     { id: "card", geometry: rectangleGeometry(10, 10, 140, 80, 8), fillRole: "surface" },
 *   ] },
 *   createNaturalPen(),
 *   { seed: 35, width: 2 },
 * );
 * ```
 */
export function generateScene(scene: Scene, pen: Pen, options: GenerateOptions = {}): DrawnScene {
	const start = performance.now();
	const seed = options.seed ?? 42;
	const maxCommands = options.maxCommands ?? 600000;
	const maxSamples = options.maxSamples ?? 200000;
	const budget: Budget = {
		commands: 0,
		samples: 0,
		addCommands(count) {
			this.commands += count;
			if (this.commands > maxCommands)
				throw new BudgetExceeded("commands", this.commands, maxCommands);
		},
		addSamples(count) {
			this.samples += count;
			if (this.samples > maxSamples)
				throw new BudgetExceeded("samples", this.samples, maxSamples);
		},
	};
	const items: DrawnItem[] = [];
	for (const item of scene.items) {
		const channels = new Map<string, number>();
		const shapeSeed = hash(`${seed}:${item.id}`);
		const context: PenContext = {
			width: options.width ?? 2.6,
			precision: options.precision ?? 0.3,
			budget,
			strokeRole: item.strokeRole ?? "ink",
			fillRole: item.fillRole,
			random(channel, index) {
				let key = channels.get(channel);
				if (key === undefined) {
					key = hash(channel) ^ shapeSeed;
					channels.set(channel, key);
				}
				let n = (key ^ Math.imul(Math.floor(index * 65536), 0x9e3779b1)) >>> 0;
				n ^= n >>> 16;
				n = Math.imul(n, 0x7feb352d);
				n ^= n >>> 15;
				n = Math.imul(n, 0x846ca68b);
				n ^= n >>> 16;
				return (n >>> 0) / 4294967296;
			},
			sample(g, maxStep = 4) {
				return sampleGeometry(g, maxStep, this.precision, budget);
			},
		};
		const before = budget.commands;
		const layers: InkLayer[] = [];
		if (item.fillRole && item.geometry.closed) {
			const fill = item.fill ?? options.fill;
			if (fill) layers.push(...fill.generate(item.geometry, context));
			else {
				budget.addCommands(item.geometry.commands.length);
				layers.push({ geometry: item.geometry, mode: "fill", role: item.fillRole });
			}
		}
		if (item.strokeRole !== "none") layers.push(...pen.generate(item.geometry, context));
		const actual = layers.reduce((count, layer) => count + layer.geometry.commands.length, 0);
		const counted = budget.commands - before;
		if (actual > counted) budget.addCommands(actual - counted);
		items.push({ id: item.id, layers, label: item.label, transform: item.transform });
	}
	return {
		width: scene.width,
		height: scene.height,
		items,
		commands: budget.commands,
		samples: budget.samples,
		generateMs: performance.now() - start,
		penId: pen.id,
		seed,
	};
}
