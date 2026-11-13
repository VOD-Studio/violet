import { useDecorationSwitcher } from "@features/seasonal-decor/hooks/useDecorationSwitcher";
import { decorationChoiceTitle } from "@features/theme-switcher/model/choices";
import {
	DEFAULT_DECORATION_LAYERS,
	type DecorationLayers,
	type DecorationPreference,
	resolveDecoration,
} from "@shared/lib/decoration-preference";
import { resolvePresetTheme, SEASONS, type ThemeState } from "@shared/lib/theme-preference";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { normalizeTheme } from "@violetjs/theme";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DecorationPicker } from "../DecorationPicker";

vi.mock("@features/seasonal-decor/hooks/useDecorationSwitcher", () => ({
	useDecorationSwitcher: vi.fn(),
}));

function renderPicker(
	initialPreference: DecorationPreference = "theme",
	theme: ThemeState = { preference: "winter", preset: "winter", custom: null },
) {
	vi.mocked(useDecorationSwitcher).mockImplementation(function useMockDecorationSwitcher() {
		const [preference, setPreference] = useState(initialPreference);
		const [layers, setLayers] = useState<DecorationLayers>(DEFAULT_DECORATION_LAYERS);
		return {
			preference,
			season: resolveDecoration(preference, theme),
			layers,
			switchDecoration: async (next) => setPreference(next),
			setLayer: async (layer, enabled) =>
				setLayers((current) => ({ ...current, [layer]: enabled })),
		};
	});
	return render(<DecorationPicker />);
}

function choose(name: string) {
	fireEvent.click(screen.getByRole("radio", { name }));
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe("DecorationPicker", () => {
	it("模式与季节分组，仅独立设置展开四季并从当前有效季节开始", () => {
		renderPicker();
		expect(
			within(screen.getByRole("radiogroup", { name: "装饰" })).getAllByRole("radio"),
		).toHaveLength(3);
		expect(screen.queryByRole("radiogroup", { name: "装饰季节" })).toBeNull();
		choose("独立设置");
		expect(
			screen
				.getByRole("radio", { name: decorationChoiceTitle("winter") })
				.getAttribute("aria-checked"),
		).toBe("true");
		for (const season of SEASONS) {
			choose(decorationChoiceTitle(season));
			expect(
				screen
					.getByRole("radio", { name: decorationChoiceTitle(season) })
					.getAttribute("aria-checked"),
			).toBe("true");
		}
	});

	it.each(["跟随主题", "关闭装饰"])("显式季节切到%s再回独立保留最近选择", (mode) => {
		renderPicker("spring");
		choose(decorationChoiceTitle("summer"));
		choose(mode);
		expect(screen.queryByRole("radiogroup", { name: "装饰季节" })).toBeNull();
		choose("独立设置");
		expect(
			screen
				.getByRole("radio", { name: decorationChoiceTitle("summer") })
				.getAttribute("aria-checked"),
		).toBe("true");
	});

	it("关闭装饰禁用图层，重新启用后恢复所有图层偏好", () => {
		renderPicker();
		fireEvent.click(screen.getByRole("switch", { name: "插画" }));
		fireEvent.click(screen.getByRole("switch", { name: "挂件" }));
		choose("关闭装饰");
		for (const toggle of screen.getAllByRole("switch"))
			expect(toggle.hasAttribute("disabled")).toBe(true);
		choose("跟随主题");
		for (const toggle of screen.getAllByRole("switch"))
			expect(toggle.hasAttribute("disabled")).toBe(false);
		expect(screen.getByRole("switch", { name: "插画" }).getAttribute("aria-checked")).toBe(
			"false",
		);
		expect(screen.getByRole("switch", { name: "飘落" }).getAttribute("aria-checked")).toBe(
			"true",
		);
		expect(screen.getByRole("switch", { name: "挂件" }).getAttribute("aria-checked")).toBe(
			"false",
		);
	});

	it.each([
		"theme",
		"none",
	] as const)("%s 无有效季节时首次独立取当季，跟随自定义明确无装饰", (preference) => {
		const now = new Date("2026-09-20T12:00:00Z");
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(now);
		renderPicker(preference, {
			preference: "winter",
			preset: "winter",
			custom: normalizeTheme(undefined),
		});
		if (preference === "theme")
			expect(document.body.contains(screen.getByText("自定义主题 · 无装饰"))).toBe(true);
		for (const toggle of screen.getAllByRole("switch"))
			expect(toggle.hasAttribute("disabled")).toBe(true);
		choose("独立设置");
		expect(
			screen
				.getByRole("radio", {
					name: decorationChoiceTitle(resolvePresetTheme("follow", now)),
				})
				.getAttribute("aria-checked"),
		).toBe("true");
		for (const toggle of screen.getAllByRole("switch"))
			expect(toggle.hasAttribute("disabled")).toBe(false);
	});

	it("模式及独立季节保留 Radix 方向键换选", async () => {
		renderPicker("winter");
		choose("跟随主题");
		const follow = screen.getByRole("radio", { name: "跟随主题" });
		act(() => follow.focus());
		fireEvent.keyDown(follow, { key: "ArrowRight" });
		await waitFor(() =>
			expect(
				screen.getByRole("radio", { name: "关闭装饰" }).getAttribute("aria-checked"),
			).toBe("true"),
		);
		fireEvent.keyDown(screen.getByRole("radio", { name: "关闭装饰" }), { key: "ArrowRight" });
		await waitFor(() =>
			expect(
				screen.getByRole("radio", { name: "独立设置" }).getAttribute("aria-checked"),
			).toBe("true"),
		);
		const winter = screen.getByRole("radio", { name: decorationChoiceTitle("winter") });
		act(() => winter.focus());
		fireEvent.keyDown(winter, { key: "ArrowRight" });
		await waitFor(() =>
			expect(
				screen
					.getByRole("radio", { name: decorationChoiceTitle("spring") })
					.getAttribute("aria-checked"),
			).toBe("true"),
		);
	});
});
