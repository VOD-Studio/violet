// @vitest-environment node
import { describe, expect, it } from "vitest";
import { type Appearance, type ContrastLevel, generateScales } from "./index.ts";
import { deltaE, displayed, PRECISIONS, parse, tintedOn, wcag } from "./test/colors.ts";
import { seasonTheme as preset, SEASON_NAMES, SEASONS } from "./test/seasons.ts";

/**
 * 期望值取自 UED 设计稿「基础」页的色值公式（docs/design/ued/project/Controls.dc.html 的 renderVals），
 * 四季共用同一组明度与色度，只有色相不同；种子色与旋钮见 test/seasons.ts。
 * 设计稿里有的取值超出 sRGB（例如深色春、冬的强调字），比较时取它在屏幕上实际显示的颜色。
 */

// 可察觉阈值（CSS Color 4 在 OKLab 中取 0.02），低于它即看不出区别。差距来自两处：设计稿四季色相取整、
// 预设色相来自种子色，相差最多约 5°；设计稿超出 sRGB 的取值由浏览器在 0.02 以内裁切，生成器只降色度。
const TOLERANCE = 0.02;

// 标准档取 WCAG AA 正文的 4.5；系统开启「提高对比度」时取 AAA 的 7
const LEVELS: [ContrastLevel, number][] = [
	["standard", 4.5],
	["more", 7],
];

const CASES = SEASON_NAMES.flatMap((season) =>
	(["light", "dark"] as const).map((appearance) => [season, appearance] as const),
);

const near = (generated: string, designCss: string) => deltaE(generated, displayed(designCss));

describe("材质：纸面、纸片、凹陷", () => {
	const design = (appearance: Appearance, hue: number) =>
		appearance === "light"
			? {
					page: `oklch(0.968 0.006 ${hue})`,
					sheet: `oklch(0.994 0.003 ${hue})`,
					sunk: `oklch(0.945 0.007 ${hue})`,
				}
			: {
					page: `oklch(0.17 0.0087 ${hue})`,
					sheet: `oklch(0.235 0.011 ${hue})`,
					sunk: `oklch(0.29 0.012 ${hue})`,
				};

	it.each(CASES)("%s %s 的三层表面等于设计稿", (season, appearance) => {
		const { material } = generateScales(preset(season), { appearance });
		const expected = design(appearance, SEASONS[season].hue);
		for (const role of ["page", "sheet", "sunk"] as const)
			expect(near(material[role], expected[role]), `${role} ${material[role]}`).toBeLessThan(
				TOLERANCE,
			);
	});
});

describe("材质：文字色、线与季节色", () => {
	const designText = (appearance: Appearance, hue: number) =>
		appearance === "light"
			? {
					fg: `oklch(0.3331 0.0175 ${hue})`,
					muted: `oklch(0.4717 0.0225 ${hue})`,
					rule: 0.11,
				}
			: {
					fg: `oklch(0.9373 0.015 ${hue})`,
					muted: `oklch(0.8573 0.0225 ${hue})`,
					rule: 0.12,
				};

	it.each(CASES)("%s %s 的正文与说明文字就是中性第 12、11 档", (season, appearance) => {
		const { neutral } = generateScales(preset(season), { appearance });
		const expected = designText(appearance, SEASONS[season].hue);
		expect(near(neutral.steps[12], expected.fg)).toBeLessThan(TOLERANCE);
		expect(near(neutral.steps[11], expected.muted)).toBeLessThan(TOLERANCE);
	});

	it.each(CASES)("%s %s 的发丝线与强线是正文色的透明度", (season, appearance) => {
		const { material } = generateScales(preset(season), { appearance });
		const expected = designText(appearance, SEASONS[season].hue);
		expect(near(material.rule, expected.fg)).toBeLessThan(TOLERANCE);
		expect(parse(material.rule).alpha).toBeCloseTo(expected.rule, 3);
		expect(near(material.rule2, expected.fg)).toBeLessThan(TOLERANCE);
		expect(parse(material.rule2).alpha).toBeCloseTo(0.3, 3);
	});

	it.each(CASES)("%s %s 的季节色就是种子色本身", (season, appearance) => {
		const { material } = generateScales(preset(season), { appearance });
		expect(material.deco).toBe(SEASONS[season].seed);
	});
});

describe("材质：强调字", () => {
	const designAccent = (appearance: Appearance, hue: number) =>
		appearance === "light" ? `oklch(0.4739 0.0974 ${hue})` : `oklch(0.8589 0.1031 ${hue})`;

	it.each(CASES)("%s %s 的强调字等于设计稿", (season, appearance) => {
		const { material } = generateScales(preset(season), { appearance });
		expect(
			near(material.accent, designAccent(appearance, SEASONS[season].hue)),
			material.accent,
		).toBeLessThan(TOLERANCE);
	});

	// 设计稿的选中态芯片：强调字放在 color-mix(季节色 16%, 底色) 上
	const ACCENT_TINT = 0.16;
	const LEVEL_CASES = CASES.flatMap(([season, appearance]) =>
		LEVELS.map(([level, ratio]) => [season, appearance, level, ratio] as const),
	);
	it.each(
		LEVEL_CASES,
	)("%s %s %s 档的强调字在三层表面与季节色着色底上达到 WCAG %d", (season, appearance, contrast, ratio) => {
		const { material } = generateScales(preset(season), { appearance, contrast });
		const surfaces = [
			material.page,
			material.sheet,
			material.sunk,
			tintedOn(material.page, material.deco, ACCENT_TINT),
			tintedOn(material.sheet, material.deco, ACCENT_TINT),
		];
		for (const surface of surfaces)
			for (const precision of PRECISIONS)
				expect(
					wcag(material.accent, surface, precision),
					`${surface} ${precision}`,
				).toBeGreaterThanOrEqual(ratio);
	});

	it("近灰的种子色不会凭空给强调字染上色度", () => {
		const gray = generateScales({ version: 1, seed: "#808080" }, { appearance: "light" });
		expect(parse(gray.material.accent).oklch.c).toBeLessThan(0.005);
	});
});

describe("材质：状态文字色", () => {
	const STATUS = {
		light: { danger: "oklch(0.52 0.16 27)", ok: "oklch(0.52 0.13 155)" },
		dark: { danger: "oklch(0.74 0.14 25)", ok: "oklch(0.74 0.15 155)" },
	} as const;
	// 设计稿里状态色作文字时放在 color-mix(状态色 N%, 底色) 上：危险色 N 为 5–12，成功色 N 为 12，取上限
	const TINT = 0.12;
	const ROLES = ["danger", "ok"] as const;

	const ROLE_CASES = CASES.flatMap(([season, appearance]) =>
		ROLES.map((role) => [season, appearance, role] as const),
	);
	it.each(
		ROLE_CASES,
	)("%s %s 的%s等于设计稿；浅色成功色为通过 AA 只允许调暗", (season, appearance, role) => {
		const color = generateScales(preset(season), { appearance }).material[role];
		const designCss = STATUS[appearance][role];
		if (appearance === "light" && role === "ok") {
			const { l, h } = parse(color).oklch;
			const design = parse(designCss).oklch;
			expect(l ?? 0, color).toBeLessThanOrEqual(design.l ?? 0);
			expect((design.l ?? 0) - (l ?? 0), color).toBeLessThanOrEqual(0.05);
			expect(Math.abs((h ?? 0) - (design.h ?? 0)), color).toBeLessThan(1);
		} else expect(near(color, designCss), color).toBeLessThan(TOLERANCE);
	});

	const LEVEL_ROLE_CASES = ROLE_CASES.flatMap(([season, appearance, role]) =>
		LEVELS.map(([level, ratio]) => [season, appearance, role, level, ratio] as const),
	);
	it.each(
		LEVEL_ROLE_CASES,
	)("%s %s 的%s在 %s 档于全部表面与着色底上达到 WCAG %d", (season, appearance, role, contrast, ratio) => {
		const { material } = generateScales(preset(season), { appearance, contrast });
		const text = material[role];
		const surfaces = [
			material.page,
			material.sheet,
			material.sunk,
			tintedOn(material.page, text, TINT),
			tintedOn(material.sheet, text, TINT),
		];
		for (const surface of surfaces)
			for (const precision of PRECISIONS)
				expect(
					wcag(text, surface, precision),
					`${text} on ${surface} ${precision}`,
				).toBeGreaterThanOrEqual(ratio);
	});
});
