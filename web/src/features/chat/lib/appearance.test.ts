import { describe, expect, it } from "vitest";
import {
	AVATAR_CHARMS,
	AVATAR_FRAMES,
	BUBBLE_THEMES,
	EMPTY_APPEARANCE,
} from "../model/appearance-catalog";
import {
	appearanceBatches,
	normalizeAppearance,
	normalizeAppearanceUserIDs,
	parseAppearanceMap,
	parseAppearanceState,
	sameAppearance,
} from "./appearance";

const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";

describe("chat appearance contract", () => {
	it("收录全部精选主题并接受每个真实目录 ID", () => {
		expect([AVATAR_FRAMES.length, AVATAR_CHARMS.length, BUBBLE_THEMES.length]).toEqual([
			8, 24, 12,
		]);
		for (const item of AVATAR_FRAMES)
			expect(normalizeAppearance({ avatar_frame_id: item.id }).avatar_frame_id).toBe(item.id);
		for (const item of AVATAR_CHARMS)
			expect(normalizeAppearance({ avatar_charm_id: item.id }).avatar_charm_id).toBe(item.id);
		for (const item of BUBBLE_THEMES)
			expect(normalizeAppearance({ bubble_theme_id: item.id }).bubble_theme_id).toBe(item.id);
	});
	it("绝不把 URL、CSS 或过期 ID 当作图片路径", () => {
		expect(
			normalizeAppearance({
				avatar_frame_id: "../../me",
				avatar_charm_id: "javascript:alert(1)",
				bubble_theme_id: "removed",
			}),
		).toEqual(EMPTY_APPEARANCE);
	});
	it("批量键规范化并去重", () => {
		expect(normalizeAppearanceUserIDs([b, a, b, "bad"])).toEqual([a, b]);
		const many = Array.from(
			{ length: 121 },
			(_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
		);
		expect(appearanceBatches(many).map((batch) => batch.length)).toEqual([50, 50, 21]);
	});
	it("拒绝缺失或非法的 revision,而不是放行破坏性的默认保存", () => {
		for (const revision of [undefined, "1", -1, NaN, 1.5, 9007199254740992])
			expect(() => parseAppearanceState({ revision })).toThrow();
		expect(parseAppearanceState({ ...EMPTY_APPEARANCE, revision: 0 }).revision).toBe(0);
	});
	it("只返回请求过的账号,不串用他人样式", () => {
		const map = parseAppearanceMap(
			{ [a]: { bubble_theme_id: "moon-letter" }, [b]: { bubble_theme_id: "tea-time" } },
			[a],
		);
		expect(map[a].bubble_theme_id).toBe("moon-letter");
		expect(map[b]).toBeUndefined();
	});
	it("重置与 revision 无关地清空全部三个维度", () => {
		expect(sameAppearance(EMPTY_APPEARANCE, { ...EMPTY_APPEARANCE })).toBe(true);
		expect(
			sameAppearance(EMPTY_APPEARANCE, {
				...EMPTY_APPEARANCE,
				avatar_frame_id: "moon-cloud",
			}),
		).toBe(false);
	});
});
