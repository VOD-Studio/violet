import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentScrollbar, ScrollArea } from "../index";

type Geometry = Partial<
	Record<
		| "scrollTop"
		| "scrollLeft"
		| "scrollHeight"
		| "scrollWidth"
		| "clientHeight"
		| "clientWidth",
		number
	>
>;

/** jsdom 没有布局，按用例写入视口的滚动尺寸。 */
function setGeometry(element: Element, geometry: Geometry) {
	for (const [key, value] of Object.entries(geometry)) {
		Object.defineProperty(element, key, { configurable: true, writable: true, value });
	}
}

function visibleFades(container: HTMLElement) {
	return Array.from(container.querySelectorAll(".v-scroll-area__fade")).map((fade) =>
		fade.getAttribute("data-edge"),
	);
}

beforeEach(() => {
	// 测量放在下一帧；测试里同步执行，事件触发后即可断言。
	vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
		callback(0);
		return 0;
	});
});

afterEach(() => {
	vi.restoreAllMocks();
	document.documentElement.removeAttribute("data-scrollbar");
	document.body.style.overflowY = "";
});

describe("ScrollArea", () => {
	it("只在仍有内容的一侧显示渐隐", () => {
		const { container } = render(<ScrollArea aria-label="章节">内容</ScrollArea>);
		const viewport = screen.getByRole("region", { name: "章节" });
		setGeometry(viewport, {
			scrollTop: 0,
			scrollHeight: 300,
			clientHeight: 100,
			scrollWidth: 200,
			clientWidth: 200,
		});

		fireEvent.scroll(viewport);
		expect(visibleFades(container)).toEqual(["bottom"]);

		viewport.scrollTop = 100;
		fireEvent.scroll(viewport);
		expect(visibleFades(container)).toEqual(["top", "bottom"]);

		viewport.scrollTop = 200;
		fireEvent.scroll(viewport);
		expect(visibleFades(container)).toEqual(["top"]);
	});

	it("纵向区域即使内容更宽也不显示左右渐隐与翻页按钮", () => {
		const { container } = render(<ScrollArea aria-label="章节">内容</ScrollArea>);
		const viewport = screen.getByRole("region", { name: "章节" });
		setGeometry(viewport, { scrollWidth: 400, clientWidth: 200 });

		fireEvent.scroll(viewport);

		expect(visibleFades(container)).toEqual([]);
		expect(screen.queryByRole("button", { name: "向右滚动" })).toBeNull();
	});

	it("横向区域翻页到头后把焦点交给视口", () => {
		render(
			<ScrollArea aria-label="章节导航" orientation="horizontal">
				内容
			</ScrollArea>,
		);
		const viewport = screen.getByRole("region", { name: "章节导航" });
		setGeometry(viewport, { scrollLeft: 0, scrollWidth: 300, clientWidth: 100 });
		viewport.scrollTo = vi.fn((options?: ScrollToOptions | number) => {
			if (typeof options === "object") viewport.scrollLeft = options.left ?? 0;
			fireEvent.scroll(viewport);
		}) as typeof viewport.scrollTo;
		fireEvent.scroll(viewport);

		expect(screen.queryByRole("button", { name: "向左滚动" })).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "向右滚动" }));
		expect(viewport.scrollTo).toHaveBeenLastCalledWith({ left: 80, behavior: "smooth" });
		expect(screen.getByRole("button", { name: "向左滚动" })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "向右滚动" }));
		fireEvent.click(screen.getByRole("button", { name: "向右滚动" }));

		expect(viewport.scrollLeft).toBe(200);
		expect(screen.queryByRole("button", { name: "向右滚动" })).toBeNull();
		expect(document.activeElement).toBe(viewport);
	});

	it("拖动滑块按可移动距离换算成滚动位置，松开后不再跟随", () => {
		const { container } = render(<ScrollArea aria-label="章节">内容</ScrollArea>);
		const viewport = screen.getByRole("region", { name: "章节" });
		setGeometry(viewport, { scrollTop: 0, scrollHeight: 400, clientHeight: 100 });
		fireEvent.scroll(viewport);

		const thumb = container.querySelector<HTMLElement>(
			'.v-scrollbar[data-axis="vertical"] > .v-scrollbar__thumb',
		);
		if (!thumb?.parentElement) throw new Error("纵向滑块没有渲染");
		thumb.setPointerCapture = vi.fn();
		// 轨道 100px、滑块 25px：可移动 75px 对应 300px 的滚动范围，每 1px 滚动 4px。
		vi.spyOn(thumb.parentElement, "getBoundingClientRect").mockReturnValue(
			new DOMRect(0, 0, 6, 100),
		);
		vi.spyOn(thumb, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 6, 25));

		fireEvent.pointerDown(thumb, { button: 0, pointerId: 1, clientY: 10 });
		fireEvent.pointerMove(thumb, { pointerId: 1, clientY: 25 });
		expect(viewport.scrollTop).toBe(60);

		fireEvent.pointerUp(thumb, { pointerId: 1 });
		fireEvent.pointerMove(thumb, { pointerId: 1, clientY: 50 });
		expect(viewport.scrollTop).toBe(60);
	});

	it("ref 与原生属性落在视口，className 落在外层", () => {
		const ref = vi.fn();
		const { container } = render(
			<ScrollArea ref={ref} aria-label="章节" className="h-64" data-testid="viewport">
				内容
			</ScrollArea>,
		);
		const viewport = screen.getByTestId("viewport");

		expect(ref).toHaveBeenCalledWith(viewport);
		expect(viewport.getAttribute("tabindex")).toBe("0");
		expect(container.firstElementChild?.classList.contains("h-64")).toBe(true);
		expect(viewport.classList.contains("h-64")).toBe(false);
	});
});

describe("DocumentScrollbar", () => {
	it("挂载期间隐藏原生滚动条，卸载后恢复宿主设置", () => {
		document.documentElement.setAttribute("data-scrollbar", "thin");

		const { unmount } = render(<DocumentScrollbar />);
		expect(document.documentElement.getAttribute("data-scrollbar")).toBe("none");

		unmount();
		expect(document.documentElement.getAttribute("data-scrollbar")).toBe("thin");
	});

	it("弹层锁定页面滚动时不显示文档滑块", async () => {
		const { container } = render(<DocumentScrollbar />);
		expect(container.querySelector(".v-document-scrollbar")).not.toBeNull();

		document.body.style.overflowY = "hidden";

		await waitFor(() => {
			expect(container.querySelector(".v-document-scrollbar")).toBeNull();
		});
	});
});
