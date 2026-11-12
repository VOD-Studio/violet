import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BadgeAnchor, Count, Dot } from "../count";

describe("Count", () => {
	it.each([0, -3])("数量为 %i 时整个徽章消失", (value) => {
		const { container } = render(<Count value={value} />);
		expect(container.innerHTML).toBe("");
	});

	it("大于 99 写 99+，恰好 99 写原数", () => {
		const { rerender } = render(<Count value={99} />);
		expect(screen.getByText("99")).toBeTruthy();
		rerender(<Count value={100} />);
		expect(screen.getByText("99+")).toBeTruthy();
	});

	it("max 可调，超出写 max+", () => {
		render(<Count value={10} max={9} />);
		expect(screen.getByText("9+")).toBeTruthy();
	});

	it("胶囊对读屏隐藏，数量由宿主名称承载", () => {
		render(
			<button type="button" aria-label="消息，3 条未读">
				<Count value={3} />
			</button>,
		);
		expect(screen.getByText("3").closest('[aria-hidden="true"]')).not.toBeNull();
		expect(screen.getByRole("button", { name: "消息，3 条未读" })).toBeTruthy();
	});

	it("行内计数是正文的一部分，读屏可读", () => {
		render(
			<a href="/comments">
				评论 <Count variant="inline" value={3} />
			</a>,
		);
		expect(screen.getByText("3").closest('[aria-hidden="true"]')).toBeNull();
		expect(screen.getByRole("link", { name: "评论 3" })).toBeTruthy();
	});

	it("数量变化时直接替换文字，不重建节点", () => {
		const { rerender } = render(<Count value={3} />);
		const node = screen.getByText("3");
		rerender(<Count value={4} />);
		expect(screen.getByText("4")).toBe(node);
	});
});

describe("Dot", () => {
	it("对读屏隐藏，不带文字", () => {
		const { container } = render(<Dot />);
		const dot = container.firstElementChild;
		expect(dot?.getAttribute("aria-hidden")).toBe("true");
		expect(dot?.textContent).toBe("");
	});
});

describe("BadgeAnchor", () => {
	it("不改变宿主：点击与焦点仍属于宿主，计数不进入宿主名称", () => {
		const click = vi.fn();
		render(
			<BadgeAnchor badge={<Count value={3} />}>
				<button type="button" onClick={click}>
					消息
				</button>
			</BadgeAnchor>,
		);
		const host = screen.getByRole("button", { name: "消息" });
		host.focus();
		expect(document.activeElement).toBe(host);
		fireEvent.click(host);
		expect(click).toHaveBeenCalledOnce();
	});

	it("增删角标时宿主节点与焦点保持", () => {
		const { rerender } = render(
			<BadgeAnchor>
				<button type="button">消息</button>
			</BadgeAnchor>,
		);
		const host = screen.getByRole("button", { name: "消息" });
		host.focus();
		rerender(
			<BadgeAnchor badge={<Dot />}>
				<button type="button">消息</button>
			</BadgeAnchor>,
		);
		expect(screen.getByRole("button", { name: "消息" })).toBe(host);
		expect(document.activeElement).toBe(host);
	});

	it("只在提供 badge 时渲染装饰层，且装饰层对读屏隐藏", () => {
		const { container, rerender } = render(
			<BadgeAnchor>
				<button type="button">消息</button>
			</BadgeAnchor>,
		);
		expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
		rerender(
			<BadgeAnchor badge={<Count value={3} />} placement="edge">
				<button type="button">消息</button>
			</BadgeAnchor>,
		);
		const decoration = container.querySelector('[aria-hidden="true"]');
		expect(decoration?.textContent).toBe("3");
		expect(decoration?.contains(screen.getByRole("button", { name: "消息" }))).toBe(false);
	});

	it("原生 span 属性落在外层包装上", () => {
		const { container } = render(
			<BadgeAnchor id="anchor" className="extra">
				<button type="button">消息</button>
			</BadgeAnchor>,
		);
		const wrapper = container.firstElementChild;
		expect(wrapper?.id).toBe("anchor");
		expect(wrapper?.classList.contains("extra")).toBe(true);
	});
});
