import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CellWithTooltip } from "../components/CellWithTooltip";

describe("CellWithTooltip", () => {
	it("字符串子节点开启 ellipsis 时渲染带 truncate 的测量元素", () => {
		const { container } = render(
			<CellWithTooltip ellipsis>Very long text content</CellWithTooltip>,
		);

		const measure = container.querySelector("span.min-w-0.max-w-full.truncate");
		expect(measure).not.toBeNull();
		expect(measure?.textContent).toBe("Very long text content");
	});

	it("单一元素子节点开启 ellipsis 时被克隆并附加 truncate 类", () => {
		const { container } = render(
			<CellWithTooltip ellipsis>
				<button type="button">Long title</button>
			</CellWithTooltip>,
		);

		const button = container.querySelector("button");
		expect(button).not.toBeNull();
		expect(button?.classList.contains("min-w-0")).toBe(true);
		expect(button?.classList.contains("max-w-full")).toBe(true);
		expect(button?.classList.contains("truncate")).toBe(true);
	});

	it("未开启 ellipsis 时不附加截断类", () => {
		const { container } = render(<CellWithTooltip>Plain text</CellWithTooltip>);

		expect(container.querySelector("span.min-w-0.max-w-full.truncate")).toBeNull();
	});
});
