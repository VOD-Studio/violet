import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "../../input";
import { FieldSummary } from "../field-summary";
import { focusField } from "../focus-field";

describe("focusField", () => {
	it("把焦点移到 id 对应的元素并返回 true；没有这个 id 返回 false", () => {
		render(<Input id="title" aria-label="标题" />);
		expect(focusField("title")).toBe(true);
		expect(document.activeElement).toBe(screen.getByRole("textbox"));
		expect(focusField("missing")).toBe(false);
	});
});

describe("FieldSummary", () => {
	it("没有错误时什么都不渲染", () => {
		const { container } = render(<FieldSummary errors={[]} />);
		expect(container.firstChild).toBeNull();
	});

	it("role=alert，可编程聚焦，默认标题带出错数量，每一条是按钮", () => {
		render(
			<FieldSummary
				errors={[
					{ id: "title", label: "标题" },
					{ id: "source", label: "转载来源" },
				]}
			/>,
		);
		const alert = screen.getByRole("alert");
		expect(alert.tabIndex).toBe(-1);
		expect(screen.getByText("还有 2 处需要修改")).toBeDefined();
		const items = screen.getAllByRole("button");
		expect(items.map((item) => item.textContent)).toEqual(["标题", "转载来源"]);
		for (const item of items) expect((item as HTMLButtonElement).type).toBe("button");
	});

	it("title 可自定义", () => {
		render(<FieldSummary errors={[{ id: "a", label: "甲" }]} title={(n) => `共 ${n} 项`} />);
		expect(screen.getByText("共 1 项")).toBeDefined();
	});

	it("点条目把焦点移到对应控件", () => {
		render(
			<>
				<FieldSummary
					errors={[
						{ id: "title", label: "标题" },
						{ id: "source", label: "转载来源" },
					]}
				/>
				<Input id="title" aria-label="标题输入" />
				<Input id="source" aria-label="来源输入" />
			</>,
		);
		fireEvent.click(screen.getByRole("button", { name: "转载来源" }));
		expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "来源输入" }));
	});
});
