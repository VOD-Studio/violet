import { parseOklch } from "@features/lab/palette/model/color-math";
import {
	BRAND_TOKENS,
	CHART_TOKENS,
	NEON_TOKENS,
	STATUS_TOKENS,
	SURFACE_LAYERS,
	TONAL_RAMP,
} from "@features/lab/palette/model/tokens";
import { describe, expect, it } from "vitest";

describe("palette tokens", () => {
	it("全部品牌令牌包含合法 oklch 颜色定义", () => {
		expect(BRAND_TOKENS.length).toBe(6);
		for (const token of BRAND_TOKENS) {
			expect(parseOklch(token.light)).not.toBeNull();
			expect(parseOklch(token.dark)).not.toBeNull();
			expect(token.variable.startsWith("--")).toBe(true);
		}
	});

	it("色阶光谱包含 11 个递增阶梯并覆盖 50 至 950", () => {
		expect(TONAL_RAMP.length).toBe(11);
		const steps = TONAL_RAMP.map((t) => t.step);
		expect(steps).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
		for (const item of TONAL_RAMP) {
			const parsed = parseOklch(item.oklch);
			expect(parsed).not.toBeNull();
			expect(parsed?.h).toBe(286);
		}
	});

	it("空间表面层级与状态色格式正确", () => {
		expect(SURFACE_LAYERS.length).toBeGreaterThanOrEqual(5);
		for (const surface of SURFACE_LAYERS) {
			expect(surface.isSurface).toBe(true);
			expect(surface.onSurfaceForeground).toBeDefined();
			expect(parseOklch(surface.onSurfaceForeground?.light ?? "")).not.toBeNull();
			expect(parseOklch(surface.onSurfaceForeground?.dark ?? "")).not.toBeNull();
		}
		expect(STATUS_TOKENS.length).toBe(3);
		expect(CHART_TOKENS.length).toBe(5);
		expect(NEON_TOKENS.length).toBe(5);
	});
});
