import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { Separator } from "..";

describe("Separator", () => {
	it("默认纯装饰，不进入可访问树", () => {
		render(<Separator data-testid="sep" />);
		expect(screen.queryByRole("separator")).toBeNull();
		expect(screen.getByTestId("sep").getAttribute("role")).toBe("none");
	});

	it("非装饰的横向分隔是原生 hr", () => {
		render(<Separator decorative={false} />);
		const sep = screen.getByRole("separator");
		expect(sep.tagName).toBe("HR");
	});

	it("非装饰的纵向分隔声明方向", () => {
		render(<Separator decorative={false} orientation="vertical" />);
		const sep = screen.getByRole("separator");
		expect(sep.getAttribute("aria-orientation")).toBe("vertical");
	});

	it("圆点形态始终装饰，即使声明非装饰", () => {
		render(<Separator variant="dot" decorative={false} data-testid="dot" />);
		expect(screen.queryByRole("separator")).toBeNull();
		expect(screen.getByTestId("dot").getAttribute("role")).toBe("none");
	});

	it("带标签的形态以标签为可访问名称，两侧线条隐藏", () => {
		render(<Separator>或</Separator>);
		const sep = screen.getByRole("separator", { name: "或" });
		expect(sep.textContent).toBe("或");
		expect(sep.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);
	});

	it("原生属性与 ref 透传", () => {
		const ref = createRef<HTMLElement>();
		render(<Separator ref={ref} decorative={false} id="x" className="caller" />);
		const sep = screen.getByRole("separator");
		expect(ref.current).toBe(sep);
		expect(sep.id).toBe("x");
		expect(sep.classList.contains("caller")).toBe(true);
	});
});
