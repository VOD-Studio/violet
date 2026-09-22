import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_TOKENS, TOKEN_GROUPS } from "../tokens";

/**
 * 防漂移对账：词典清单 ↔ 样式映射层（styles/theme.css）。
 *
 * 两个方向都查：清单收录了映射层没有的幽灵 token，或映射层的
 * 核心 token 未被词典收录，任一失衡本测试即红。
 */
const themeCss = readFileSync(resolve(import.meta.dirname, "../../../../styles/theme.css"), "utf8");

/** 提取映射层全部颜色映射：--color-<stem>: var(--<varName>) */
function extractMappings(): Set<string> {
	const pairs = new Set<string>();
	const pattern = /--color-([\w-]+):\s*var\((--[\w-]+)\)/g;
	for (const [, stem, varName] of themeCss.matchAll(pattern)) {
		pairs.add(`${stem}\u0000${varName}`);
	}
	return pairs;
}

describe("token 词典与映射层对账", () => {
	const mappings = extractMappings();

	it("词典无幽灵 token：每个条目都在映射层真实存在", () => {
		const missing = ALL_TOKENS.filter((t) => !mappings.has(`${t.stem}\u0000${t.varName}`));
		expect(missing.map((t) => t.varName)).toEqual([]);
	});

	it("映射层核心 token 未收录即红：词典覆盖全部颜色映射", () => {
		const documented = new Set(ALL_TOKENS.map((t) => `${t.stem}\u0000${t.varName}`));
		const undocumented = [...mappings].filter((key) => !documented.has(key));
		expect(undocumented).toEqual([]);
	});
});

describe("token 词典清单自洽", () => {
	it("分组内变量名与词干唯一", () => {
		const varNames = ALL_TOKENS.map((t) => t.varName);
		expect(new Set(varNames).size).toBe(varNames.length);
	});

	it("每个条目的用途成文", () => {
		const blank = ALL_TOKENS.filter((t) => t.purpose.trim().length === 0);
		expect(blank).toEqual([]);
	});

	it("六个分组齐备", () => {
		expect(TOKEN_GROUPS.map((g) => g.id)).toEqual([
			"semantic",
			"brand",
			"paper",
			"legacy",
			"chart",
			"neon",
		]);
	});
});
