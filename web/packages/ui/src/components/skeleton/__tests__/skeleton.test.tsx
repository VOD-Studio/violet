import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "..";

describe("Skeleton", () => {
	it("默认是对读屏隐藏的占位", () => {
		const { container } = render(<Skeleton />);
		expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
	});

	it("aria-hidden 可被调用方覆盖", () => {
		const { container } = render(
			<Skeleton aria-hidden={false} role="img" aria-label="头像加载中" />,
		);
		const el = container.firstElementChild as HTMLElement;
		expect(el.getAttribute("aria-hidden")).toBe("false");
		expect(el.getAttribute("aria-label")).toBe("头像加载中");
	});

	it("原生属性、style 与 ref 透传，className 保留调用方类名", () => {
		const ref = createRef<HTMLDivElement>();
		const { container } = render(
			<Skeleton ref={ref} id="s" style={{ width: 40 }} className="h-4 w-2/3 rounded-full" />,
		);
		const el = container.firstElementChild as HTMLDivElement;
		expect(ref.current).toBe(el);
		expect(el.id).toBe("s");
		expect(el.style.width).toBe("40px");
		for (const name of ["h-4", "w-2/3", "rounded-full"]) {
			expect(el.classList.contains(name)).toBe(true);
		}
	});
});
