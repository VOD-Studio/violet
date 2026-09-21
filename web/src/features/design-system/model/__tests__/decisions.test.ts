import { describe, expect, it } from "vitest";
import { ALL_DECISIONS, DECISION_CATEGORIES, findUnanchoredDecisions } from "../decisions";

describe("快速决策表防漂移", () => {
	it("每行引用的 token 都锚定在词典清单（进而锚定映射层）", () => {
		expect(findUnanchoredDecisions()).toEqual([]);
	});

	it("每行场景与理由成文", () => {
		const blank = ALL_DECISIONS.filter(
			(row) => row.scene.trim().length === 0 || row.reason.trim().length === 0,
		);
		expect(blank).toEqual([]);
	});

	it("六个裁定分类齐备", () => {
		expect(DECISION_CATEGORIES.map((c) => c.id)).toEqual([
			"surface",
			"text",
			"action",
			"line",
			"focus",
			"chart",
		]);
	});
});
