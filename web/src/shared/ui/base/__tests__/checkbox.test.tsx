import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Checkbox, checkboxVariants } from "../checkbox";

describe("Checkbox Component", () => {
	afterEach(cleanup);

	it("默认未勾选渲染，具备 role=checkbox 与 data-slot 属性", () => {
		render(<Checkbox aria-label="同意协议" />);
		const cb = screen.getByRole("checkbox", { name: "同意协议" });
		expect(cb).toBeDefined();
		expect(cb.getAttribute("aria-checked")).toBe("false");
		expect(cb.getAttribute("data-state")).toBe("unchecked");
		expect(cb.getAttribute("data-slot")).toBe("checkbox");
		expect(cb.getAttribute("data-variant")).toBe("default");
		expect(cb.getAttribute("data-size")).toBe("default");
	});

	it("受控 checked=true 时展示勾选状态与对应属性", () => {
		render(<Checkbox checked aria-label="记住密码" />);
		const cb = screen.getByRole("checkbox", { name: "记住密码" });
		expect(cb.getAttribute("aria-checked")).toBe("true");
		expect(cb.getAttribute("data-state")).toBe("checked");
		expect(cb.querySelector("svg.lucide-check")).not.toBeNull();
	});

	it("受控 checked='indeterminate' 时展示半选状态 (aria-checked='mixed')", () => {
		render(<Checkbox checked="indeterminate" aria-label="全选列表" />);
		const cb = screen.getByRole("checkbox", { name: "全选列表" });
		expect(cb.getAttribute("aria-checked")).toBe("mixed");
		expect(cb.getAttribute("data-state")).toBe("indeterminate");
		// 包含半选 Minus 减号图标
		expect(cb.querySelector("svg.lucide-minus")).not.toBeNull();
	});

	it("点击时触发 onCheckedChange 回调并传递正确布尔值", () => {
		const handleCheckedChange = vi.fn();
		render(<Checkbox onCheckedChange={handleCheckedChange} aria-label="订阅通知" />);
		const cb = screen.getByRole("checkbox", { name: "订阅通知" });
		fireEvent.click(cb);
		expect(handleCheckedChange).toHaveBeenCalledWith(true);
	});
	it("非受控 defaultChecked=true 时初始为勾选并支持点击切换", () => {
		const handleCheckedChange = vi.fn();
		render(
			<Checkbox
				defaultChecked
				onCheckedChange={handleCheckedChange}
				aria-label="开启功能"
			/>,
		);
		const cb = screen.getByRole("checkbox", { name: "开启功能" });
		expect(cb.getAttribute("aria-checked")).toBe("true");
		fireEvent.click(cb);
		expect(handleCheckedChange).toHaveBeenCalledWith(false);
	});
	it("禁用状态下阻止交互且标记 disabled", () => {
		const handleCheckedChange = vi.fn();
		render(<Checkbox disabled onCheckedChange={handleCheckedChange} aria-label="只读项" />);
		const cb = screen.getByRole("checkbox", { name: "只读项" });
		expect((cb as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(cb);
		expect(handleCheckedChange).not.toHaveBeenCalled();
	});

	it.each(["default", "brand"] as const)("正确应用 %s 变体并标记 data-variant", (variant) => {
		render(<Checkbox variant={variant} aria-label={`${variant} 复选框`} />);
		const cb = screen.getByRole("checkbox", { name: `${variant} 复选框` });
		expect(cb.getAttribute("data-variant")).toBe(variant);
	});

	it.each(["sm", "default", "lg"] as const)("正确应用 %s 尺寸并标记 data-size", (size) => {
		render(<Checkbox size={size} aria-label={`${size} 复选框`} />);
		const cb = screen.getByRole("checkbox", { name: `${size} 复选框` });
		expect(cb.getAttribute("data-size")).toBe(size);
	});

	it("导出 checkboxVariants 工具函数", () => {
		const classes = checkboxVariants({ variant: "brand", size: "lg" });
		expect(classes).toContain("data-[state=checked]:bg-brand");
		expect(classes).toContain("size-5");
	});
});
