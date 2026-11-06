import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { Input } from "../../input";
import { Label } from "../label";

describe("Label", () => {
	it("htmlFor 为控件提供可访问名称，ref 指向 label", () => {
		const ref = createRef<HTMLLabelElement>();
		render(
			<>
				<Label ref={ref} htmlFor="email">
					联系邮箱
				</Label>
				<Input id="email" />
			</>,
		);
		expect(screen.getByRole("textbox", { name: "联系邮箱" })).toBeDefined();
		expect(ref.current).toBe(screen.getByText("联系邮箱"));
		expect(ref.current?.htmlFor).toBe("email");
	});

	it("asChild 保留已有 Radix 组合契约", () => {
		render(
			<>
				<Label asChild htmlFor="title">
					<label htmlFor="title" className="custom-label">
						标题
					</label>
				</Label>
				<Input id="title" />
			</>,
		);
		expect(screen.getByRole("textbox", { name: "标题" })).toBeDefined();
		expect(screen.getByText("标题").classList.contains("custom-label")).toBe(true);
	});
});
