import { describe, expect, it } from "vitest";
import { generatePalette } from "../palette";

describe("色板生成器", () => {
	const palette = generatePalette({ h: 222, c: 0.16 });

	it("品牌色阶 ×11，浅到深，hex 均为 7 位", () => {
		expect(palette.ramp).toHaveLength(11);
		expect(palette.ramp[0].label).toBe("50");
		expect(palette.ramp[10].label).toBe("950");
		for (const step of palette.ramp) {
			expect(step.hex).toMatch(/^#[0-9a-f]{6}$/);
		}
	});

	it("主色与强调只收标准语义 token,中性带独立", () => {
		expect(palette.primaryRoles.map((role) => role.role)).toEqual([
			"--primary",
			"--primary-hover",
			"--primary-foreground",
			"--accent",
			"--accent-foreground",
		]);
		expect(palette.neutral.map((role) => role.role)).toEqual([
			"--background",
			"--foreground",
			"--card",
			"--muted",
			"--muted-foreground",
			"--border",
			"--input",
		]);
		// 同一域列内色值互不相同
		const roles = [...palette.primaryRoles, ...palette.neutral];
		const lightHexes = roles.map((role) => role.light.hex);
		const darkHexes = roles.map((role) => role.dark.hex);
		expect(new Set(lightHexes).size).toBe(lightHexes.length);
		expect(new Set(darkHexes).size).toBe(darkHexes.length);
	});

	it("同种子输出确定", () => {
		expect(generatePalette({ h: 222, c: 0.16 })).toEqual(palette);
	});

	it("核心配对全部通过 WCAG 审计", () => {
		const failing = palette.audits.filter((audit) => !audit.pass);
		expect(failing).toEqual([]);
	});

	it("中性带带种子色相晕染：同 L 不同种子的画布色相不同", () => {
		const other = generatePalette({ h: 120, c: 0.16 });
		expect(other.neutral[0].light.oklch).not.toBe(palette.neutral[0].light.oklch);
	});

	it("功能色为固定行为语义，不随种子更迭，且具备完整的实色与浅染层级", () => {
		const other = generatePalette({ h: 120, c: 0.3 });
		expect(other.functional).toEqual(palette.functional);
		expect(palette.functionalSets.map((s) => s.key)).toEqual([
			"info",
			"success",
			"warning",
			"destructive",
		]);
		for (const set of palette.functionalSets) {
			expect(set.light.solid.hex).toMatch(/^#[0-9a-f]{6}$/);
			expect(set.light.wash.hex).toMatch(/^#[0-9a-f]{6}$/);
			expect(set.dark.solid.hex).toMatch(/^#[0-9a-f]{6}$/);
			expect(set.dark.wash.hex).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});
