import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useCustomThemeDraft } from "../useCustomThemeDraft";

describe("自定义主题草稿", () => {
	afterEach(cleanup);

	it("非法输入保留最后合法预览，输入中不报错，失焦后显示错误", () => {
		const { result } = renderHook(() => useCustomThemeDraft(true, "#f47983"));
		act(() => result.current.changeDraft("ABC"));
		expect(result.current.theme.seed).toBe("#aabbcc");
		act(() => result.current.changeDraft("ABCG"));
		expect(result.current.draft).toBe("ABCG");
		expect(result.current.theme.seed).toBe("#aabbcc");
		expect(result.current.valid).toBe(false);
		expect(result.current.showError).toBe(false);
		act(() => {
			result.current.validate();
			result.current.setValidity(false);
		});
		expect(result.current.showError).toBe(true);
		act(() => result.current.pickColor("#2f9e7a"));
		expect(result.current.valid).toBe(true);
		expect(result.current.showError).toBe(false);
		expect(result.current.theme.seed).toBe("#2f9e7a");
	});

	it("连续合法取色不改变原色比较基准，再打开从当前主题重新开始", () => {
		const { result, rerender } = renderHook(
			({ open, seed }) => useCustomThemeDraft(open, seed),
			{ initialProps: { open: true, seed: "#f47983" } },
		);
		act(() => {
			result.current.setPickerOpen(true);
			result.current.pickColor("#2f9e7a");
		});
		expect(result.current.originalSeed).toBe("#f47983");
		rerender({ open: false, seed: "#7d8ea3" });
		rerender({ open: true, seed: "#7d8ea3" });
		expect(result.current.originalSeed).toBe("#7d8ea3");
		expect(result.current.draft).toBe("#7d8ea3");
		expect(result.current.theme.seed).toBe("#7d8ea3");
		expect(result.current.pickerOpen).toBe(false);
	});
});
