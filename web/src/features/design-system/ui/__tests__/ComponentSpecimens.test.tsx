import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComponentSpecimens } from "../ComponentSpecimens";

describe("组件活样例", () => {
	it("按钮全变体以真实控件渲染", () => {
		render(<ComponentSpecimens />);
		for (const name of [
			"主要动作",
			"次要动作",
			"描边动作",
			"品牌动作",
			"危险动作",
			"幽灵动作",
		]) {
			expect(screen.getByRole("button", { name })).toBeTruthy();
		}
	});

	it("每组标注 token 出处", () => {
		render(<ComponentSpecimens />);
		expect(screen.getAllByText(/bg-primary/).length).toBeGreaterThan(0);
		expect(screen.getByText("禁用态")).toBeTruthy();
	});
});
