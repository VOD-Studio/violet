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

	it("语义角色与现行 token 角色一一对应", () => {
		expect(palette.semantic.map((role) => role.role)).toEqual([
			"--background",
			"--foreground",
			"--card",
			"--muted",
			"--muted-foreground",
			"--accent",
			"--border",
			"--input",
			"--primary",
			"--ring",
		]);
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
		expect(other.semantic[0].light.oklch).not.toBe(palette.semantic[0].light.oklch);
	});
});
