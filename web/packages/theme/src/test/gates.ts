import type { ContrastLevel, Step } from "../index.ts";
import { apca, type Measured, measure, PRECISIONS, wcag } from "./colors.ts";
import { describeTheme, namedScales, type Sample, STEPS } from "./sweep.ts";

type Threshold = { wcag: number; apca?: number };

export interface Gate {
	name: string;
	/**
	 * WCAG 2.2 AA 是硬约束：低于 `wcag` 的组合让测试失败。文字的 `apca` 是按用途分级的
	 * 参考下限，只告警不失败（ADR-0029）；装饰与边框不检查 APCA。
	 */
	threshold: Record<ContrastLevel, Threshold>;
	/** 前景：某几档，或实色上的前景色 */
	texts: (Step | "contrast")[];
	/** 背景档 */
	on: Step[];
	/** shared：中性、品牌与该色阶自己的背景档；own：只用该色阶自己的档位 */
	surfaces: "shared" | "own";
	/** 只检查名称匹配的色阶 */
	only?: (name: string) => boolean;
}

// 第 1 档是背景，第 2 档是表面，第 3–5 档是组件底色及其悬停、按下
export const GATES: Gate[] = [
	{
		name: "正文对背景与表面",
		threshold: { standard: { wcag: 4.5, apca: 90 }, more: { wcag: 7, apca: 100 } },
		texts: [12],
		on: [1, 2],
		surfaces: "shared",
	},
	{
		name: "次要文字与链接对背景与表面",
		threshold: { standard: { wcag: 4.5, apca: 75 }, more: { wcag: 7, apca: 90 } },
		texts: [11],
		on: [1, 2],
		surfaces: "shared",
	},
	{
		name: "正文对组件底色",
		threshold: { standard: { wcag: 4.5, apca: 75 }, more: { wcag: 7, apca: 90 } },
		texts: [12],
		on: [3, 4, 5],
		surfaces: "shared",
	},
	{
		name: "次要文字与链接对组件底色",
		threshold: { standard: { wcag: 4.5, apca: 60 }, more: { wcag: 7, apca: 75 } },
		texts: [11],
		on: [3, 4, 5],
		surfaces: "shared",
	},
	{
		name: "控件边界与焦点环对背景与表面",
		threshold: { standard: { wcag: 3 }, more: { wcag: 4.5 } },
		texts: [7, 8],
		on: [1, 2],
		surfaces: "shared",
	},
	{
		name: "实色上的前景",
		threshold: { standard: { wcag: 4.5, apca: 60 }, more: { wcag: 7, apca: 75 } },
		texts: ["contrast"],
		on: [9, 10],
		surfaces: "own",
	},
	{
		// 分类色用作图表系列，属于 WCAG 1.4.11 要求 3:1 的图形
		name: "分类色实色作为图形对背景与表面",
		threshold: { standard: { wcag: 3 }, more: { wcag: 4.5 } },
		texts: [9, 10],
		on: [1, 2],
		surfaces: "shared",
		only: (name) => name.startsWith("category"),
	},
];

export interface MeasuredScale {
	name: string;
	css: string[];
	colors: Measured[];
	contrast: Measured;
	contrastCss: string;
}

/** 每个样本的全部色阶先测量一次，比较时不再按字符串查缓存。 */
export const measureSample = ({ scales }: Sample): MeasuredScale[] =>
	namedScales(scales).map(([name, scale]) => {
		const css = STEPS.map((step) => scale.steps[step]);
		return {
			name,
			css,
			colors: css.map(measure),
			contrast: measure(scale.contrast),
			contrastCss: scale.contrast,
		};
	});

export interface GateResult {
	/** 低于 WCAG 下限的组合，硬约束 */
	failures: string[];
	/** 达到 WCAG 下限但低于 APCA 参考值的组合总数，只告警 */
	advisoryCount: number;
	/** 前三条告警示例，不保留整轮遍历的重复日志 */
	advisories: string[];
}

/** 某一门槛在全部样本上的不达标组合；WCAG 不达标是失败，仅 APCA 偏低是告警。 */
export function evaluateGate(
	gate: Gate,
	samples: Sample[],
	measured: MeasuredScale[][],
	contrast: ContrastLevel,
): GateResult {
	const { wcag: minWcag, apca: reference } = gate.threshold[contrast];
	const result: GateResult = { failures: [], advisoryCount: 0, advisories: [] };
	samples.forEach((sample, index) => {
		const scales = measured[index] ?? [];
		const [brand, neutral] = scales as [MeasuredScale, MeasuredScale];
		for (const scale of scales) {
			if (gate.only && !gate.only(scale.name)) continue;
			// 每条色阶的文字放在中性、品牌与它自己的背景档上
			const surfaces =
				gate.surfaces === "own"
					? [scale]
					: scale === brand || scale === neutral
						? [neutral, brand]
						: [neutral, brand, scale];
			for (const text of gate.texts) {
				// 状态色阶的正文与次要文字按状态用途参考 Lc 45（提高档 Lc 60）
				const apcaReference =
					(text === 11 || text === 12) &&
					(scale.name === "danger" ||
						scale.name === "warning" ||
						scale.name === "success")
						? Math.min(reference ?? Infinity, contrast === "more" ? 60 : 45)
						: reference;
				const foreground =
					text === "contrast" ? scale.contrast : (scale.colors[text - 1] as Measured);
				for (const surface of surfaces) {
					for (const step of gate.on) {
						const background = surface.colors[step - 1] as Measured;
						for (const precision of PRECISIONS) {
							const ratio = wcag(foreground, background, precision);
							if (ratio >= minWcag && apcaReference === undefined) continue;
							const lc = apca(foreground, background, precision);
							if (
								ratio >= minWcag &&
								apcaReference !== undefined &&
								lc >= apcaReference
							)
								continue;
							const failed = ratio < minWcag;
							if (!failed) result.advisoryCount++;
							if (!failed && result.advisories.length >= 3) continue;
							const label =
								text === "contrast" ? scale.contrastCss : scale.css[text - 1];
							const line = `${describeTheme(sample.theme)} ${scale.name} ${label} on ${surface.css[step - 1]} (${precision}): WCAG ${ratio.toFixed(2)}, APCA ${lc.toFixed(1)}`;
							(failed ? result.failures : result.advisories).push(line);
						}
					}
				}
			}
		}
	});
	return result;
}
