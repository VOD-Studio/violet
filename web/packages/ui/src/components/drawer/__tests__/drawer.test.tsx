import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	Drawer,
	DrawerBody,
	DrawerContent,
	type DrawerContentProps,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "../drawer";

const PANEL_HEIGHT = 400;

beforeEach(() => {
	vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(PANEL_HEIGHT);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function ShareDrawer({
	withField = false,
	...props
}: Partial<DrawerContentProps> & { withField?: boolean }) {
	return (
		<Drawer>
			<DrawerTrigger>分享</DrawerTrigger>
			<DrawerContent aria-describedby={undefined} {...props}>
				<DrawerHeader>
					<DrawerTitle>分享</DrawerTitle>
				</DrawerHeader>
				<DrawerBody>
					{withField ? (
						<textarea aria-label="写评论" />
					) : (
						<button type="button">复制链接</button>
					)}
				</DrawerBody>
			</DrawerContent>
		</Drawer>
	);
}

const panel = () => screen.queryByRole("dialog");
const openDrawer = () => {
	const trigger = screen.getByRole("button", { name: "分享" });
	trigger.focus();
	fireEvent.click(trigger);
	return trigger;
};

/** 在 time 毫秒时把指针移到 y；jsdom 不让构造事件时指定 timeStamp，React 会把 0 当缺省，time 从 1 起。 */
function pointer(
	type: "pointerdown" | "pointermove" | "pointerup",
	target: EventTarget,
	y: number,
	time: number,
) {
	const event = new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		clientY: y,
		pointerId: 1,
		pointerType: "mouse",
		button: 0,
	});
	Object.defineProperty(event, "timeStamp", { value: time });
	act(() => {
		target.dispatchEvent(event);
	});
}

function drag(from: Element, steps: [y: number, time: number][]) {
	const [start, ...rest] = steps;
	pointer("pointerdown", from, start[0], start[1]);
	for (const [y, time] of rest) pointer("pointermove", window, y, time);
	const [y, time] = steps.at(-1) ?? start;
	pointer("pointerup", window, y, time);
}

const handle = () => {
	const element = document.querySelector("[data-slot='drawer-handle']");
	if (!element) throw new Error("缺少把手");
	return element;
};
const offset = () => panel()?.style.getPropertyValue("--v-drawer-offset");

describe("Drawer", () => {
	it("是模态对话框，以标题命名，打开时焦点进标题", () => {
		render(<ShareDrawer />);
		openDrawer();
		const dialog = screen.getByRole("dialog", { name: "分享" });
		expect(dialog.getAttribute("aria-modal")).toBe("true");
		expect(document.activeElement).toBe(screen.getByRole("heading", { name: "分享" }));
	});

	it("有输入框时焦点进输入框", () => {
		render(<ShareDrawer withField />);
		openDrawer();
		expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "写评论" }));
	});

	it("Esc 与点遮罩关闭，关闭后焦点回到打开它的按钮", async () => {
		render(<ShareDrawer />);
		const trigger = openDrawer();
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
		expect(panel()).toBeNull();
		await waitFor(() => expect(document.activeElement).toBe(trigger));
		openDrawer();
		await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
		fireEvent.pointerDown(document.body, { pointerType: "mouse", button: 0 });
		fireEvent.pointerUp(document.body, { pointerType: "mouse", button: 0 });
		fireEvent.click(document.body);
		expect(panel()).toBeNull();
	});

	it("往下拖超过可见高度的 25% 关闭", () => {
		render(<ShareDrawer />);
		openDrawer();
		drag(handle(), [
			[100, 1],
			[150, 300],
			[210, 600],
			[220, 1200],
		]);
		expect(panel()).toBeNull();
	});

	it("拖得不够时弹回原位", () => {
		render(<ShareDrawer />);
		openDrawer();
		drag(handle(), [
			[100, 1],
			[140, 400],
			[150, 900],
		]);
		expect(panel()).not.toBeNull();
		expect(offset()).toBe("0px");
		expect(panel()?.hasAttribute("data-dragging")).toBe(false);
	});

	it("快速下滑即使距离不够也关闭", () => {
		render(<ShareDrawer />);
		openDrawer();
		drag(handle(), [
			[100, 1],
			[110, 10],
			[160, 60],
		]);
		expect(panel()).toBeNull();
	});

	it("拖动时跟手，越过最高处有阻力", () => {
		render(<ShareDrawer />);
		openDrawer();
		pointer("pointerdown", handle(), 300, 1);
		pointer("pointermove", window, 340, 50);
		expect(offset()).toBe("40px");
		expect(panel()?.hasAttribute("data-dragging")).toBe(true);
		pointer("pointermove", window, 200, 100);
		expect(Number.parseFloat(offset() ?? "0")).toBeGreaterThan(-100);
		pointer("pointerup", window, 200, 900);
	});

	describe("半屏与全屏两档", () => {
		it("先停在半屏，快速上滑到全屏，全屏快速下滑回到半屏", () => {
			render(<ShareDrawer snapPoints="half-full" />);
			openDrawer();
			expect(panel()?.getAttribute("data-detent")).toBe("half");
			const half = Number.parseFloat(offset() ?? "0");
			expect(half).toBeGreaterThan(0);
			drag(handle(), [
				[400, 1],
				[380, 10],
				[300, 60],
			]);
			expect(panel()?.getAttribute("data-detent")).toBe("full");
			drag(handle(), [
				[300, 1000],
				[320, 1010],
				[380, 1060],
			]);
			expect(panel()?.getAttribute("data-detent")).toBe("half");
			expect(panel()).not.toBeNull();
		});

		it("半屏时从内容区拖也带动面板", () => {
			render(<ShareDrawer snapPoints="half-full" />);
			openDrawer();
			const body = document.querySelector("[data-slot='drawer-body'] button");
			if (!body) throw new Error("缺少内容");
			drag(body, [
				[400, 1],
				[380, 10],
				[300, 60],
			]);
			expect(panel()?.getAttribute("data-detent")).toBe("full");
		});
	});
});
