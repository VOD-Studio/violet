import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "../pagination";

/** 导航里按顺序排出的页码文字与省略号（「…」）。 */
function sequence(): string[] {
	const nav = screen.getByRole("navigation", { name: "分页" });
	const pageButtons = within(nav)
		.getAllByRole("button")
		.filter((button) => !/^(上|下)一页$/.test(button.getAttribute("aria-label") ?? ""));
	const ellipses = nav.querySelectorAll("[data-ellipsis]");
	const items = [...pageButtons, ...ellipses].sort((a, b) =>
		a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
	);
	return items.map((item) => item.textContent ?? "");
}

function setup(page: number, totalPages: number) {
	const onPageChange = vi.fn();
	render(<Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />);
	return onPageChange;
}

describe("Pagination 页码序列", () => {
	it("总页数 ≤ 1 不渲染", () => {
		const { container } = render(<Pagination page={1} totalPages={1} onPageChange={vi.fn()} />);
		expect(container.innerHTML).toBe("");
	});

	it("总页数很少且当前页居中时全部列出，没有省略号", () => {
		setup(3, 5);
		expect(sequence()).toEqual(["1", "2", "3", "4", "5"]);
	});

	it("总页数 2：只有首末两页", () => {
		setup(1, 2);
		expect(sequence()).toEqual(["1", "2"]);
	});

	it("当前页在最前端：只在末页前出现右省略号", () => {
		setup(1, 20);
		expect(sequence()).toEqual(["1", "2", "…", "20"]);
	});

	it("当前页在最末端：只在首页后出现左省略号", () => {
		setup(20, 20);
		expect(sequence()).toEqual(["1", "…", "19", "20"]);
	});

	it("当前页靠近前端但与首页相邻时不出现左省略号", () => {
		setup(3, 20);
		expect(sequence()).toEqual(["1", "2", "3", "4", "…", "20"]);
	});

	it("当前页靠近末端但与末页相邻时不出现右省略号", () => {
		setup(18, 20);
		expect(sequence()).toEqual(["1", "…", "17", "18", "19", "20"]);
	});

	it("当前页在中间：两侧省略号，当前页与左右各一页保留", () => {
		setup(10, 20);
		expect(sequence()).toEqual(["1", "…", "9", "10", "11", "…", "20"]);
	});

	it("省略号不是按钮，也不被读屏读出", () => {
		setup(10, 20);
		const ellipses = document.querySelectorAll("[data-ellipsis]");
		expect(ellipses).toHaveLength(2);
		for (const ellipsis of ellipses) {
			expect(ellipsis.tagName).not.toBe("BUTTON");
			expect(ellipsis.getAttribute("aria-hidden")).toBe("true");
		}
	});
});

describe("Pagination 语义", () => {
	it("nav 名称是「分页」，当前页 aria-current=page，页码按钮名称是「第 N 页」", () => {
		setup(10, 20);
		expect(screen.getByRole("navigation", { name: "分页" })).toBeTruthy();
		const current = screen.getByRole("button", { name: "第 10 页" });
		expect(current.getAttribute("aria-current")).toBe("page");
		expect(screen.getByRole("button", { name: "第 9 页" }).hasAttribute("aria-current")).toBe(
			false,
		);
	});

	it("nav 的原生属性透传，aria-label 可改", () => {
		render(
			<Pagination
				page={2}
				totalPages={5}
				onPageChange={vi.fn()}
				aria-label="评论分页"
				data-testid="pg"
			/>,
		);
		expect(screen.getByRole("navigation", { name: "评论分页" })).toBe(screen.getByTestId("pg"));
	});
});

describe("Pagination 交互", () => {
	it("点页码回调该页", () => {
		const onPageChange = setup(10, 20);
		fireEvent.click(screen.getByRole("button", { name: "第 11 页" }));
		expect(onPageChange).toHaveBeenCalledExactlyOnceWith(11);
	});

	it("上一页、下一页回调相邻页", () => {
		const onPageChange = setup(10, 20);
		fireEvent.click(screen.getByRole("button", { name: "上一页" }));
		expect(onPageChange).toHaveBeenLastCalledWith(9);
		fireEvent.click(screen.getByRole("button", { name: "下一页" }));
		expect(onPageChange).toHaveBeenLastCalledWith(11);
		expect(onPageChange).toHaveBeenCalledTimes(2);
	});

	it("第一页时上一页禁用，不回调且仍可聚焦", () => {
		const onPageChange = setup(1, 5);
		const prev = screen.getByRole("button", { name: "上一页" });
		expect(prev.getAttribute("aria-disabled")).toBe("true");
		fireEvent.click(prev);
		expect(onPageChange).not.toHaveBeenCalled();
		prev.focus();
		expect(document.activeElement).toBe(prev);
		expect(screen.getByRole("button", { name: "下一页" }).hasAttribute("aria-disabled")).toBe(
			false,
		);
	});

	it("最后一页时下一页禁用，不回调", () => {
		const onPageChange = setup(5, 5);
		const next = screen.getByRole("button", { name: "下一页" });
		expect(next.getAttribute("aria-disabled")).toBe("true");
		fireEvent.click(next);
		expect(onPageChange).not.toHaveBeenCalled();
	});
});
