import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	AnnotationCardFrame,
	AnnotationMark,
	AnnotationToolButton,
	AnnotationToolbar,
} from "../annotation";

describe("Annotation", () => {
	afterEach(cleanup);
	it("标记以具名 mark 按钮输出，Enter 与 Space 各激活一次", () => {
		const click = vi.fn();
		const ref = createRef<HTMLElement>();
		render(
			<AnnotationMark ref={ref} aria-label="1 条批注：原文" onClick={click}>
				原文
			</AnnotationMark>,
		);
		const mark = screen.getByRole("button", { name: "1 条批注：原文" });
		expect(mark.tagName).toBe("MARK");
		expect(ref.current).toBe(mark);
		expect(mark.tabIndex).toBe(0);
		fireEvent.keyDown(mark, { key: "Enter" });
		fireEvent.keyDown(mark, { key: " " });
		fireEvent.keyDown(mark, { key: "Enter", repeat: true });
		expect(click).toHaveBeenCalledTimes(2);
	});
	it("宿主取消键盘事件后不再合成激活", () => {
		const click = vi.fn();
		render(
			<AnnotationMark
				aria-label="批注"
				onKeyDown={(event) => event.preventDefault()}
				onClick={click}
			>
				原文
			</AnnotationMark>,
		);
		fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
		fireEvent.keyDown(screen.getByRole("button"), { key: " " });
		expect(click).not.toHaveBeenCalled();
	});
	it("工具栏保留原生按钮禁用、取消选区事件与 ref", () => {
		const toolbarRef = createRef<HTMLDivElement>();
		const buttonRef = createRef<HTMLButtonElement>();
		const click = vi.fn();
		render(
			<AnnotationToolbar ref={toolbarRef} aria-label="划词操作">
				<AnnotationToolButton
					ref={buttonRef}
					onMouseDown={(event) => event.preventDefault()}
				>
					批注
				</AnnotationToolButton>
				<AnnotationToolButton disabled onClick={click}>
					复制
				</AnnotationToolButton>
			</AnnotationToolbar>,
		);
		expect(toolbarRef.current).toBe(screen.getByRole("toolbar", { name: "划词操作" }));
		const annotate = screen.getByRole("button", { name: "批注" });
		expect(buttonRef.current).toBe(annotate);
		expect(annotate.getAttribute("type")).toBe("button");
		expect(fireEvent.mouseDown(annotate)).toBe(false);
		fireEvent.click(screen.getByRole("button", { name: "复制" }));
		expect(click).not.toHaveBeenCalled();
	});
	it("纸片 ref 和属性属于唯一根节点，SSR 不访问浏览器或产生隐式 dialog", () => {
		const ref = createRef<HTMLDivElement>();
		const { container } = render(
			<AnnotationCardFrame ref={ref} id="note" aria-label="批注内容">
				正文
			</AnnotationCardFrame>,
		);
		expect(ref.current).toBe(container.firstElementChild);
		expect(ref.current?.id).toBe("note");
		expect(ref.current?.hasAttribute("role")).toBe(false);
		const html = renderToString(
			<AnnotationCardFrame>
				<AnnotationMark aria-label="批注：原文">原文</AnnotationMark>
			</AnnotationCardFrame>,
		);
		expect(html).toContain('<mark aria-label="批注：原文"');
		expect(html).toContain('role="button"');
		expect(html).not.toContain('role="dialog"');
	});
});
