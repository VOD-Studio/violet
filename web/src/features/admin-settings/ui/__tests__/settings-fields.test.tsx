import { fireEvent, render, screen } from "@testing-library/react";
import { Input } from "@violet/ui";
import { describe, expect, it, vi } from "vitest";
import { Field, SwitchField } from "../settings-fields";

describe("设置页表单项", () => {
	it("标签与控件关联，横排，提示写在控件下面", () => {
		const { container } = render(
			<Field label="自定义表情上限" hint="0 表示使用部署默认值">
				<Input type="number" />
			</Field>,
		);
		const input = screen.getByLabelText("自定义表情上限", { exact: true });
		expect(input.tagName).toBe("INPUT");
		expect(container.querySelector(".v-field--horizontal")).not.toBeNull();
		const hint = screen.getByText("0 表示使用部署默认值");
		expect(input.getAttribute("aria-describedby")).toBe(hint.closest("[aria-live]")?.id);
	});

	it("开关行的标签点击即切换", () => {
		const change = vi.fn();
		render(<SwitchField label="启用评论" checked={false} onCheckedChange={change} />);
		expect(screen.getByRole("switch", { name: "启用评论" })).toBeDefined();
		fireEvent.click(screen.getByText("启用评论"));
		expect(change).toHaveBeenCalledWith(true);
	});
});
