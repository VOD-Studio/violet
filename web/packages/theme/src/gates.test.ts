// @vitest-environment node
import { beforeAll, describe, it } from "vitest";
import type { Scale, Step, ThemeScales } from "./index.ts";
import { apca, PRECISIONS, wcag } from "./test/colors.ts";
import {
	APPEARANCES,
	describeTheme,
	expectNoFailures,
	type Sample,
	SWEEP_TIMEOUT,
	sweep,
	THEMES,
} from "./test/sweep.ts";

type Pair = [text: string, background: string];

interface Gate {
	name: string;
	wcag: number;
	/**
	 * APCA Lc 绝对值下限，按 APCA 的用途分档：90 是字号表中 16px/400 正文的要求，75 是正文的最低值，
	 * 60 是正文以外的可读内容文字（标签、按钮文字），30 是有语义的非文字元素，15 是大面积按钮可辨的下限
	 */
	apca: number;
	pairs: (scale: Scale, scales: ThemeScales) => Pair[];
}

/** 文字档对两条色阶的背景档逐一配对。 */
const on =
	(texts: Step[], backgrounds: Step[]) =>
	(scale: Scale, scales: ThemeScales): Pair[] =>
		texts.flatMap((text) =>
			[scales.neutral, scales.brand].flatMap((surface) =>
				backgrounds.map(
					(background): Pair => [scale.steps[text], surface.steps[background]],
				),
			),
		);

// 第 1 档是背景，第 2 档是表面，第 3–5 档是组件底色及其悬停、按下
const GATES: Gate[] = [
	{ name: "正文对背景与表面", wcag: 4.5, apca: 90, pairs: on([12], [1, 2]) },
	{ name: "次要文字与链接对背景与表面", wcag: 4.5, apca: 75, pairs: on([11], [1, 2]) },
	{ name: "正文对组件底色", wcag: 4.5, apca: 75, pairs: on([12], [3, 4, 5]) },
	{ name: "次要文字与链接对组件底色", wcag: 4.5, apca: 60, pairs: on([11], [3, 4, 5]) },
	{
		name: "控件边界与焦点环对背景与表面",
		wcag: 3,
		apca: 30,
		pairs: on([7, 8], [1, 2]),
	},
	// WCAG 1.4.11 不要求带文字按钮的填充色与页面对比，只用 APCA 对大面积按钮的可辨下限
	{ name: "实色与背景可辨", wcag: 1, apca: 15, pairs: on([9, 10], [1, 2]) },
	{
		name: "实色上的前景",
		wcag: 4.5,
		apca: 60,
		pairs: (scale) =>
			([9, 10] as const).map((step): Pair => [scale.contrast, scale.steps[step]]),
	},
];

describe.each(APPEARANCES)("%s 外观遍历全部色相、色度与旋钮", (appearance) => {
	let samples: Sample[];
	beforeAll(() => {
		samples = sweep(appearance);
	}, SWEEP_TIMEOUT);

	it.each(GATES)(
		"$name 同时通过 WCAG 2.2 AA 与 APCA",
		(gate) => {
			const failures: string[] = [];
			for (const { theme, scales } of samples) {
				for (const [name, scale] of [
					["brand", scales.brand],
					["neutral", scales.neutral],
				] as const) {
					for (const [text, background] of gate.pairs(scale, scales)) {
						for (const precision of PRECISIONS) {
							const ratio = wcag(text, background, precision);
							const lc = apca(text, background, precision);
							if (ratio < gate.wcag || lc < gate.apca)
								failures.push(
									`${describeTheme(theme)} ${name} ${text} on ${background} (${precision}): WCAG ${ratio.toFixed(2)}, APCA ${lc.toFixed(1)}`,
								);
						}
					}
				}
			}
			expectNoFailures(failures);
		},
		SWEEP_TIMEOUT,
	);

	it(`覆盖 ${THEMES.length} 个主题`, () => {
		expectNoFailures(samples.length === THEMES.length ? [] : [`${samples.length} samples`]);
	});
});
