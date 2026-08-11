/**
 * PendingBadge 组件测试
 *
 * 验证「审批中」徽章仅在 show=true 时渲染（PRD-0001 状态可见性）。
 * 断言风格跟随项目惯例（.length/.toBeTruthy，无 jest-dom）。
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PendingBadge } from "../pending-badge";

describe("PendingBadge", () => {
	afterEach(() => {
		cleanup();
	});

	it("show=true 时渲染徽章", () => {
		render(<PendingBadge show={true} />);
		expect(screen.getAllByText("审批中").length).toBe(1);
	});

	it("show=false 时不渲染", () => {
		render(<PendingBadge show={false} />);
		expect(screen.queryByText("审批中")).toBeNull();
	});
});
