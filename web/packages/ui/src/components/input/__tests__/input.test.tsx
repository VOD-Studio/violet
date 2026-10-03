import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Input } from "../input";

describe("Input", () => {
	it("原生属性和 ref 直接落在 input", () => {
		const ref = createRef<HTMLInputElement>();
		render(
			<Input
				ref={ref}
				aria-label="邮箱"
				type="email"
				name="email"
				autoComplete="email"
				required
				maxLength={80}
				className="max-w-80"
			/>,
		);
		const input = screen.getByRole("textbox", { name: "邮箱" }) as HTMLInputElement;
		expect(ref.current).toBe(input);
		expect(input.type).toBe("email");
		expect(input.name).toBe("email");
		expect(input.required).toBe(true);
		expect(input.maxLength).toBe(80);
		expect(input.autocomplete).toBe("email");
		expect(input.classList.contains("max-w-80")).toBe(true);
	});

	it("受控值由消费方更新，onChange 保留原生事件", () => {
		const change = vi.fn();
		const { rerender } = render(
			<Input
				aria-label="姓名"
				value="初值"
				onChange={(event) => change(event.currentTarget.value)}
			/>,
		);
		const input = screen.getByRole("textbox", { name: "姓名" }) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "编辑值" } });
		expect(change).toHaveBeenCalledExactlyOnceWith("编辑值");
		expect(input.value).toBe("初值");
		rerender(<Input aria-label="姓名" value="新值" onChange={change} />);
		expect(input.value).toBe("新值");
	});

	it("非受控表单值参与 FormData 和 reset，禁用字段由浏览器排除", () => {
		const { container } = render(
			<form>
				<Input aria-label="姓名" name="name" defaultValue="初值" />
				<Input name="hidden-disabled" defaultValue="排除" disabled />
			</form>,
		);
		const form = container.querySelector("form") as HTMLFormElement;
		const input = screen.getByRole("textbox", { name: "姓名" }) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "编辑值" } });
		expect(new FormData(form).get("name")).toBe("编辑值");
		expect(new FormData(form).has("hidden-disabled")).toBe(false);
		form.reset();
		expect(input.value).toBe("初值");
	});
});
