import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Textarea } from "../textarea";

describe("Textarea", () => {
	it("原生属性和 callback ref 透传，多行内容参与表单重置", () => {
		const ref = vi.fn();
		const { container, unmount } = render(
			<form>
				<Textarea
					ref={ref}
					aria-label="正文"
					name="body"
					rows={8}
					defaultValue={"第一行\n第二行"}
					required
				/>
			</form>,
		);
		const textarea = screen.getByRole("textbox", { name: "正文" }) as HTMLTextAreaElement;
		const form = container.querySelector("form") as HTMLFormElement;
		expect(ref).toHaveBeenCalledWith(textarea);
		expect(textarea.rows).toBe(8);
		expect(textarea.required).toBe(true);
		fireEvent.change(textarea, { target: { value: "新正文" } });
		expect(new FormData(form).get("body")).toBe("新正文");
		form.reset();
		expect(textarea.value).toBe("第一行\n第二行");
		unmount();
		expect(ref.mock.calls.at(-1)?.[0]).toBeNull();
	});

	it("受控值不变更消费方状态，object ref 指向 textarea", () => {
		const ref = createRef<HTMLTextAreaElement>();
		const change = vi.fn();
		const { rerender } = render(
			<Textarea
				ref={ref}
				aria-label="正文"
				value="旧值"
				onChange={(event) => change(event.currentTarget.value)}
			/>,
		);
		const textarea = screen.getByRole("textbox", { name: "正文" }) as HTMLTextAreaElement;
		expect(ref.current).toBe(textarea);
		fireEvent.change(textarea, { target: { value: "编辑值" } });
		expect(change).toHaveBeenCalledExactlyOnceWith("编辑值");
		expect(textarea.value).toBe("旧值");
		rerender(<Textarea ref={ref} aria-label="正文" value="新值" onChange={change} />);
		expect(textarea.value).toBe("新值");
	});
});
