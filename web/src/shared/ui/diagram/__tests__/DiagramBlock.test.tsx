import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiagramBlock } from "../DiagramBlock";
import { renderMermaid } from "../render-mermaid";

afterEach(cleanup);

vi.mock("../render-mermaid", () => ({
	renderMermaid: vi.fn().mockResolvedValue({ svg: "<svg data-testid='mock-svg'/>" }),
}));
beforeEach(() => {
	vi.mocked(renderMermaid).mockClear();
	vi.mocked(renderMermaid).mockResolvedValue({ svg: "<svg data-testid='mock-svg'/>" });
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText: vi.fn().mockResolvedValue(undefined) },
		configurable: true,
	});
});

describe("DiagramBlock 加载与渲染", () => {
	it("渲染失败保留源码，局部重试后显示完整图表", async () => {
		vi.mocked(renderMermaid).mockResolvedValueOnce({
			error: "syntax error",
			cause: new Error("syntax error"),
		});
		const { container } = render(<DiagramBlock format="mermaid" source="bad source" />);
		expect((await screen.findByRole("alert")).textContent).toContain("图表渲染失败");
		expect(container.querySelector("code")?.textContent).toBe("bad source");
		vi.mocked(renderMermaid).mockResolvedValue({ svg: "<svg id='recovered'/>" });
		fireEvent.click(screen.getByRole("button", { name: "重试图表" }));
		await waitFor(() => expect(container.querySelector("#recovered")).toBeTruthy());
		expect(screen.queryByRole("alert")).toBeNull();
	});
});

describe("DiagramBlock aria-label 语义化", () => {
	it("源码含 title 关键字 → aria-label 取标题", async () => {
		render(
			<DiagramBlock
				format="mermaid"
				source={"flowchart TD\n    title: 订单流程\n    A --> B"}
			/>,
		);
		await waitFor(() => {
			expect(screen.getByRole("img")).toBeTruthy();
		});
		expect(screen.getByRole("img").getAttribute("aria-label")).toBe("订单流程");
	});

	it("源码无标题信息 → aria-label 降级「Mermaid 图表」", async () => {
		render(<DiagramBlock format="mermaid" source="flowchart TD\n    A --> B" />);
		await waitFor(() => {
			expect(screen.getByRole("img")).toBeTruthy();
		});
		expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Mermaid 图表");
	});
});

describe("DiagramBlock 复制按钮", () => {
	it("点击复制按钮调用 clipboard.writeText 并切换为已复制态", async () => {
		render(<DiagramBlock format="mermaid" source="graph TD" />);
		// 等渲染完成（工具条出现）
		await waitFor(() => {
			expect(screen.getByLabelText("复制 mermaid 源码")).toBeTruthy();
		});

		const copyBtn = screen.getByLabelText("复制 mermaid 源码");
		fireEvent.click(copyBtn);

		await waitFor(() => {
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith("graph TD");
		});
		// 复制后 aria-label/title 切换为「已复制」
		await waitFor(() => {
			expect(screen.getByTitle("已复制")).toBeTruthy();
		});
	});
});
