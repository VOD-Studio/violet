import type { ContrastLevel, Step } from "../index.ts";
import { apca, type Measured, measure, PRECISIONS, wcag } from "./colors.ts";
import { describeTheme, namedScales, type Sample, STEPS } from "./sweep.ts";

type Threshold = { wcag: number; apca: number };

export interface Gate {
	name: string;
	/**
	 * 标准档的 APCA Lc 绝对值下限按 APCA 的用途分档：90 是字号表中 16px/400 正文的要求，75 是正文的最低值，
	 * 60 是正文以外的可读内容文字（标签、按钮文字），30 是有语义的非文字元素，15 是大面积按钮可辨的下限。
	 * 提高档按 APCA 的 AAA 换算上调 Lc 15（正文在近白背景上至多做到 Lc 100），WCAG 文字取 AAA 的 7、非文字取 4.5。
	 */
	threshold: Record<ContrastLevel, Threshold>;
	/** 前景：某几档，或实色上的前景色 */
	texts: (Step | "contrast")[];
	/** 背景档 */
	on: Step[];
	/** shared：中性与品牌的背景档；own：只用该色阶自己的档位 */
	surfaces: "shared" | "own";
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
		threshold: { standard: { wcag: 3, apca: 30 }, more: { wcag: 4.5, apca: 45 } },
		texts: [7, 8],
		on: [1, 2],
		surfaces: "shared",
	},
	{
		// WCAG 1.4.11 不要求带文字按钮的填充色与页面对比，只用 APCA 对大面积按钮的可辨下限
		name: "实色与背景可辨",
		threshold: { standard: { wcag: 1, apca: 15 }, more: { wcag: 1, apca: 30 } },
		texts: [9, 10],
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

/** 某一门槛在全部样本上的不达标组合。 */
export function gateFailures(
	gate: Gate,
	samples: Sample[],
	measured: MeasuredScale[][],
	contrast: ContrastLevel,
) {
	const { wcag: minWcag, apca: minApca } = gate.threshold[contrast];
	const failures: string[] = [];
	samples.forEach((sample, index) => {
		const scales = measured[index] ?? [];
		const [brand, neutral] = scales as [MeasuredScale, MeasuredScale];
		for (const scale of scales) {
			const surfaces = gate.surfaces === "own" ? [scale] : [neutral, brand];
			for (const text of gate.texts) {
				const foreground =
					text === "contrast" ? scale.contrast : (scale.colors[text - 1] as Measured);
				for (const surface of surfaces) {
					for (const step of gate.on) {
						const background = surface.colors[step - 1] as Measured;
						for (const precision of PRECISIONS) {
							const ratio = wcag(foreground, background, precision);
							const lc = apca(foreground, background, precision);
							if (ratio >= minWcag && lc >= minApca) continue;
							const label =
								text === "contrast" ? scale.contrastCss : scale.css[text - 1];
							failures.push(
								`${describeTheme(sample.theme)} ${scale.name} ${label} on ${surface.css[step - 1]} (${precision}): WCAG ${ratio.toFixed(2)}, APCA ${lc.toFixed(1)}`,
							);
						}
					}
				}
			}
		}
	});
	return failures;
}
