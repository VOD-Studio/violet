import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { UploadTile } from "../upload-tile";

describe("UploadTile", () => {
	it("忙碌与禁用阻止重复激活，恢复后可通过原生 ref 操作", () => {
		const ref = createRef<HTMLButtonElement>();
		const click = vi.fn();
		const { rerender, unmount } = render(
			<UploadTile ref={ref} aria-label="添加图片" busy onClick={click} />,
		);
		const button = screen.getByRole("button", { name: "添加图片" });
		fireEvent.click(button);
		ref.current?.click();
		expect(click).not.toHaveBeenCalled();
		expect(button.getAttribute("aria-busy")).toBe("true");
		rerender(<UploadTile ref={ref} aria-label="添加图片" disabled onClick={click} />);
		fireEvent.click(button);
		expect(click).not.toHaveBeenCalled();
		rerender(<UploadTile ref={ref} aria-label="添加图片" onClick={click} />);
		expect(button.hasAttribute("aria-busy")).toBe(false);
		ref.current?.focus();
		expect(document.activeElement).toBe(button);
		ref.current?.click();
		expect(click).toHaveBeenCalledOnce();
		unmount();
		expect(ref.current).toBeNull();
	});

	it("消费方可以取消原生提交并获得 callback ref 清理", () => {
		const submit = vi.fn((event) => event.preventDefault());
		const cleanup = vi.fn();
		const ref = vi.fn(() => cleanup);
		const { rerender, unmount } = render(
			<form onSubmit={submit}>
				<UploadTile ref={ref} type="submit" onClick={(event) => event.preventDefault()}>
					添加图片
				</UploadTile>
			</form>,
		);
		fireEvent.click(screen.getByRole("button", { name: "添加图片" }));
		expect(submit).not.toHaveBeenCalled();
		rerender(
			<form onSubmit={submit}>
				<UploadTile ref={ref} type="submit">
					添加图片
				</UploadTile>
			</form>,
		);
		fireEvent.click(screen.getByRole("button", { name: "添加图片" }));
		expect(submit).toHaveBeenCalledOnce();
		unmount();
		expect(cleanup).toHaveBeenCalledOnce();
	});
});
