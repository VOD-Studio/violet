/**
 * MathEditPanel 测试
 *
 * 弹层编辑面板（行内/块级共用）的交互契约：
 * 源码输入受控、Esc 关闭、行内 Enter 关闭而块级 Enter 换行、
 * 预览区实时渲染（白名单管线）且非法公式内嵌 katex-error。
 */
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MathEditPanel } from "../MathEditPanel";

describe("MathEditPanel", () => {
	it("行内模式渲染单行 input", () => {
		const { container } = render(
			<MathEditPanel
				latex="x+1"
				displayMode={false}
				onChange={() => {}}
				onClose={() => {}}
			/>,
		);
		expect(container.querySelector("input")).toBeTruthy();
		expect(container.querySelector("textarea")).toBeNull();
	});

	it("块级模式渲染多行 textarea", () => {
		const { container } = render(
			<MathEditPanel
				latex={"a\\\\b"}
				displayMode={true}
				onChange={() => {}}
				onClose={() => {}}
			/>,
		);
		expect(container.querySelector("textarea")).toBeTruthy();
	});

	it("输入触发 onChange", () => {
		const onChange = vi.fn();
		const { container } = render(
			<MathEditPanel latex="x" displayMode={false} onChange={onChange} onClose={() => {}} />,
		);
		const input = container.querySelector("input");
		if (!input) throw new Error("无 input");
		fireEvent.change(input, { target: { value: "x+1" } });
		expect(onChange).toHaveBeenCalledWith("x+1");
	});

	it("Esc 触发 onClose（行内与块级）", () => {
		for (const displayMode of [false, true]) {
			const onClose = vi.fn();
			const { container } = render(
				<MathEditPanel
					latex="x"
					displayMode={displayMode}
					onChange={() => {}}
					onClose={onClose}
				/>,
			);
			const field = container.querySelector(displayMode ? "textarea" : "input");
			if (!field) throw new Error("无输入框");
			fireEvent.keyDown(field, { key: "Escape" });
			expect(onClose).toHaveBeenCalledTimes(1);
		}
	});

	it("行内 Enter 触发 onClose", () => {
		const onClose = vi.fn();
		const { container } = render(
			<MathEditPanel latex="x" displayMode={false} onChange={() => {}} onClose={onClose} />,
		);
		const input = container.querySelector("input");
		if (!input) throw new Error("无 input");
		fireEvent.keyDown(input, { key: "Enter" });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("块级 Enter 换行不触发 onClose", () => {
		const onClose = vi.fn();
		const { container } = render(
			<MathEditPanel latex="x" displayMode={true} onChange={() => {}} onClose={onClose} />,
		);
		const textarea = container.querySelector("textarea");
		if (!textarea) throw new Error("无 textarea");
		fireEvent.keyDown(textarea, { key: "Enter" });
		expect(onClose).not.toHaveBeenCalled();
	});

	it("预览区实时渲染合法公式，无 katex-error", () => {
		const { container } = render(
			<MathEditPanel
				latex="\\sqrt{2}"
				displayMode={true}
				onChange={() => {}}
				onClose={() => {}}
			/>,
		);
		expect(container.querySelector(".katex")).toBeTruthy();
		expect(container.querySelector(".katex-error")).toBeNull();
	});

	it("非法公式预览区内嵌 katex-error，不白屏", () => {
		const { container } = render(
			<MathEditPanel
				latex="\\frac{1"
				displayMode={true}
				onChange={() => {}}
				onClose={() => {}}
			/>,
		);
		expect(container.querySelector(".katex-error")).toBeTruthy();
	});

	it("传入 onDelete 时渲染删除按钮，点击触发回调", () => {
		const onDelete = vi.fn();
		const { container } = render(
			<MathEditPanel
				latex="x"
				displayMode={true}
				onChange={() => {}}
				onClose={() => {}}
				onDelete={onDelete}
			/>,
		);
		const delBtn = [...container.querySelectorAll("button")].find((b) =>
			b.textContent?.includes("删除"),
		);
		expect(delBtn).toBeTruthy();
		if (!delBtn) throw new Error("无删除按钮");
		fireEvent.click(delBtn);
		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	it("不传 onDelete 时不渲染删除按钮", () => {
		const { container } = render(
			<MathEditPanel latex="x" displayMode={true} onChange={() => {}} onClose={() => {}} />,
		);
		const delBtn = [...container.querySelectorAll("button")].find((b) =>
			b.textContent?.includes("删除"),
		);
		expect(delBtn).toBeFalsy();
	});
});
