// @vitest-environment node
import { describe, it } from "vitest";
import { generateScales } from "./index.ts";
import { evaluateGate, GATES, measureSample } from "./test/gates.ts";
import { SEASON_NAMES, seasonTheme } from "./test/seasons.ts";
import { COMBINATIONS, expectNoFailures, type Sample } from "./test/sweep.ts";

/** 四季设计输入 × 明暗 × 对比度档位，共 16 套色阶都须通过 WCAG 2.2 AA。 */
describe.each(SEASON_NAMES)("预设 %s", (season) => {
	const theme = seasonTheme(season);

	it.each(COMBINATIONS)("$appearance $contrast 档的全部色阶通过 WCAG 2.2 AA", ({
		appearance,
		contrast,
	}) => {
		const sample: Sample = { theme, scales: generateScales(theme, { appearance, contrast }) };
		const measured = [measureSample(sample)];
		for (const gate of GATES)
			expectNoFailures(evaluateGate(gate, [sample], measured, contrast).failures);
	});
});
