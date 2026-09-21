import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ALL_DECISIONS } from "../../model/decisions";
import { QuickDecisionTable } from "../QuickDecisionTable";

describe("快速决策表", () => {
	it("陈列车全部裁定行，token 名为可复制文本", () => {
		render(<QuickDecisionTable />);
		expect(screen.getAllByText(/^(bg|text|border|ring|hover:bg)-/)).toHaveLength(
			ALL_DECISIONS.length,
		);
		expect(screen.getByText("bg-primary")).toBeTruthy();
	});

	it("表尾有回退箴言指引", () => {
		render(<QuickDecisionTable />);
		expect(screen.getByText(/查无此项/)).toBeTruthy();
	});
});
