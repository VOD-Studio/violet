import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImagePreview } from "../components/ImagePreview";

const sizes = new Map<string, { w: number; h: number }>();
const requests = new Map<string, Set<ProbeImage>>();

class ProbeImage {
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	naturalWidth = 0;
	naturalHeight = 0;
	complete = false;

	set src(value: string) {
		const group = requests.get(value) ?? new Set<ProbeImage>();
		group.add(this);
		requests.set(value, group);
		const size = sizes.get(value);
		if (size) queueMicrotask(() => this.resolve(size.w, size.h));
	}

	resolve(w: number, h: number) {
		this.naturalWidth = w;
		this.naturalHeight = h;
		this.complete = true;
		this.onload?.();
	}
}

class TestPointerEvent extends MouseEvent {
	readonly pointerId: number;
	readonly isPrimary: boolean;

	constructor(type: string, init: PointerEventInit = {}) {
		super(type, init);
		this.pointerId = init.pointerId ?? 1;
		this.isPrimary = init.isPrimary ?? true;
	}
}

const images = ["/small.jpg", "/portrait.jpg", "/wide.jpg"];
const alts = ["湖畔", "山峰", "海岸"];
const thumbnails = ["/small-thumb.jpg", "/portrait-thumb.jpg", "/wide-thumb.jpg"];

function Harness() {
	const [index, setIndex] = useState(0);
	return (
		<ImagePreview
			open
			images={images}
			alts={alts}
			thumbnails={thumbnails}
			currentIndex={index}
			onIndexChange={setIndex}
			onClose={() => {}}
		/>
	);
}

async function image(alt: string) {
	const element = await screen.findByAltText(alt);
	if (!(element instanceof HTMLImageElement)) throw new Error("未找到原图");
	return element;
}

function stage() {
	const element = document.querySelector<HTMLElement>(
		'[aria-label="图片预览"] > [aria-hidden="false"]',
	);
	if (!element) throw new Error("未找到当前图片手势区");
	return element;
}

function swipe(dx: number, dy = 0, cancelled = false) {
	const target = stage();
	fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: 500, clientY: 400 });
	fireEvent.pointerMove(target, { pointerId: 1, clientX: 500 + dx, clientY: 400 + dy });
	if (cancelled) fireEvent.pointerCancel(target, { pointerId: 1 });
	else fireEvent.pointerUp(target, { pointerId: 1, clientX: 500 + dx, clientY: 400 + dy });
	fireEvent.click(target);
}

beforeEach(() => {
	sizes.clear();
	requests.clear();
	sizes.set(images[0], { w: 400, h: 300 });
	sizes.set(images[1], { w: 900, h: 1800 });
	sizes.set(images[2], { w: 1600, h: 900 });
	vi.stubGlobal("Image", ProbeImage);
	vi.stubGlobal("PointerEvent", TestPointerEvent);
	vi.stubGlobal("innerWidth", 1000);
	vi.stubGlobal("innerHeight", 800);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("ImagePreview 尺寸与加载", () => {
	it("独立缩略图不放大小原图，首次显示即使用原始尺寸", async () => {
		render(<Harness />);
		const original = await image("湖畔");
		expect(original.parentElement?.style.width).toBe("400px");
		expect(original.parentElement?.style.height).toBe("300px");
		fireEvent.load(original);
		expect(original.parentElement?.style.width).toBe("400px");
	});

	it("大图按视口等比缩小，窗口改变后重新适配", async () => {
		render(<ImagePreview open images={[images[2]]} alts={["海岸"]} onClose={() => {}} />);
		const original = await image("海岸");
		expect(original.parentElement?.style.width).toBe("900px");
		expect(original.parentElement?.style.height).toBe("506.25px");
		vi.stubGlobal("innerWidth", 500);
		fireEvent.resize(window);
		expect(original.parentElement?.style.width).toBe("450px");
		expect(original.parentElement?.style.height).toBe("253.125px");
	});

	it("重新打开时读取本次首图尺寸，不复用上次显示盒", async () => {
		sizes.clear();
		const props = { images: ["/uncached.jpg"], alts: ["首图"], onClose: () => {} };
		const view = render(<ImagePreview open={false} {...props} />);
		view.rerender(<ImagePreview open {...props} initialNaturalSize={{ w: 400, h: 300 }} />);
		expect((await image("首图")).parentElement?.style.width).toBe("400px");
		view.rerender(<ImagePreview open={false} {...props} />);
		await waitFor(() => expect(document.querySelector('[aria-label="图片预览"]')).toBeNull());
		view.rerender(<ImagePreview open {...props} initialNaturalSize={{ w: 200, h: 500 }} />);
		const original = await image("首图");
		expect(original.parentElement?.style.width).toBe("200px");
		expect(original.parentElement?.style.height).toBe("500px");
	});

	it("慢原图期间保留缩略图，并允许立即切到下一张", async () => {
		sizes.delete(images[0]);
		render(<Harness />);
		expect(document.querySelector(`img[src='${thumbnails[0]}'][aria-hidden]`)).not.toBeNull();
		fireEvent.keyDown(window, { key: "ArrowRight" });
		const next = await image("山峰");
		await act(async () => {
			for (const request of requests.get(images[0]) ?? []) request.resolve(400, 300);
		});
		expect(next.parentElement?.style.width).toBe("360px");
		expect(next.parentElement?.style.height).toBe("720px");
	});

	it("原图解码前保留占位，解码完成后再展示原图", async () => {
		render(<Harness />);
		const original = await image("湖畔");
		let finish = () => {};
		Object.defineProperty(original, "decode", {
			value: () =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		});
		fireEvent.load(original);
		expect(original.style.opacity).toBe("0");
		expect(document.querySelector(`img[src='${thumbnails[0]}'][aria-hidden]`)).not.toBeNull();
		await act(async () => finish());
		expect(original.style.opacity).toBe("1");
		await waitFor(() =>
			expect(document.querySelector(`img[src='${thumbnails[0]}'][aria-hidden]`)).toBeNull(),
		);
	});

	it("退场期间完成解码的图片，再次切回仍可显示原图", async () => {
		render(<Harness />);
		const original = await image("湖畔");
		let finish = () => {};
		Object.defineProperty(original, "decode", {
			value: () =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		});
		fireEvent.load(original);
		fireEvent.keyDown(window, { key: "ArrowRight" });
		await image("山峰");
		await act(async () => finish());
		fireEvent.keyDown(window, { key: "ArrowLeft" });
		await waitFor(() => expect(stage().querySelector("img[alt='湖畔']")).toBe(original));
		expect(original.style.opacity).toBe("1");
	});

	it("原图加载失败仍可继续浏览其他图片", async () => {
		sizes.delete(images[0]);
		render(<Harness />);
		act(() => {
			for (const request of requests.get(images[0]) ?? []) request.onerror?.();
		});
		expect(screen.getByRole("alert")).not.toBeNull();
		fireEvent.keyDown(window, { key: "ArrowRight" });
		expect((await image("山峰")).parentElement?.style.height).toBe("720px");
	});
});

describe("ImagePreview 导航与手势", () => {
	it("横竖图同时进出场，各自保持比例而不是等待旧图退场", async () => {
		render(<Harness />);
		const previous = await image("湖畔");
		fireEvent.load(previous);
		fireEvent.keyDown(window, { key: "ArrowRight" });
		const next = await image("山峰");
		expect(previous.isConnected).toBe(true);
		expect(previous.parentElement?.style.width).toBe("400px");
		expect(previous.parentElement?.style.height).toBe("300px");
		expect(next.parentElement?.style.width).toBe("360px");
		expect(next.parentElement?.style.height).toBe("720px");
	});

	it("快速连续导航不丢步骤，首尾均可循环", async () => {
		render(<Harness />);
		await image("湖畔");
		act(() => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
		});
		await waitFor(() => expect(stage().querySelector("img[alt='海岸']")).not.toBeNull());
		fireEvent.keyDown(window, { key: "ArrowRight" });
		await waitFor(() => expect(stage().querySelector("img[alt='湖畔']")).not.toBeNull());
		fireEvent.keyDown(window, { key: "ArrowLeft" });
		await waitFor(() => expect(stage().querySelector("img[alt='海岸']")).not.toBeNull());
	});

	it("切图退出后重新打开，仅挂载本次点击的图片", async () => {
		const props = { images, alts, thumbnails, onClose: () => {} };
		const view = render(<ImagePreview open {...props} currentIndex={0} />);
		await image("湖畔");
		fireEvent.keyDown(window, { key: "ArrowRight" });
		await image("山峰");
		view.rerender(<ImagePreview open={false} {...props} currentIndex={1} />);
		await waitFor(() => expect(document.querySelector('[aria-label="图片预览"]')).toBeNull());
		view.rerender(<ImagePreview open {...props} currentIndex={2} />);
		await image("海岸");
		expect(screen.queryByAltText("山峰")).toBeNull();
		expect(document.querySelector(`img[src='${thumbnails[1]}'][aria-hidden]`)).toBeNull();
	});

	it("退出动画未结束便重开时，新会话只显示本次选图", async () => {
		const props = { images, alts, thumbnails, onClose: () => {} };
		const view = render(<ImagePreview open {...props} currentIndex={0} />);
		await image("湖畔");
		view.rerender(<ImagePreview open={false} {...props} currentIndex={0} />);
		view.rerender(<ImagePreview open {...props} currentIndex={2} />);
		await image("海岸");
		const current = screen.getByRole("dialog");
		expect(current.querySelector("img[alt='湖畔']")).toBeNull();
		expect(current.querySelector("img[alt='海岸']")).not.toBeNull();
	});

	it("左右拖动循环切图，拖动后的 click 不关闭预览", async () => {
		const onClose = vi.fn();
		render(<ImagePreview open images={images} alts={alts} onClose={onClose} />);
		await image("湖畔");
		swipe(-200);
		await image("山峰");
		swipe(200);
		await waitFor(() => expect(stage().querySelector("img[alt='湖畔']")).not.toBeNull());
		expect(onClose).not.toHaveBeenCalled();
	});

	it("快速滑回尚在退场的图片时清除拖动偏移", async () => {
		render(<Harness />);
		const original = await image("湖畔");
		const pan = original.parentElement?.parentElement;
		swipe(-200);
		await waitFor(() => expect(pan?.style.transform).toContain("-200px"));
		fireEvent.keyDown(window, { key: "ArrowLeft" });
		await waitFor(() => expect(stage().querySelector("img[alt='湖畔']")).toBe(original));
		await waitFor(() => expect(pan?.style.transform).toBe("none"));
	});

	it("仅图片接收滚轮缩放，背景、工具栏与缩略图不缩放", async () => {
		render(<Harness />);
		const original = await image("湖畔");
		fireEvent.load(original);
		fireEvent.wheel(stage(), { deltaY: -200 });
		fireEvent.wheel(screen.getByTitle("左旋转"), { deltaY: -200 });
		fireEvent.wheel(screen.getByAltText("缩略图 1"), { deltaY: -200 });
		expect(screen.getByText("100%")).not.toBeNull();
		fireEvent.wheel(original, { deltaY: -200 });
		expect(screen.getByText("120%")).not.toBeNull();
		fireEvent.wheel(stage(), { deltaY: -200 });
		expect(screen.getByText("120%")).not.toBeNull();
	});

	it("短拖动、纵向拖动与取消手势都不切图", async () => {
		const onIndexChange = vi.fn();
		const onClose = vi.fn();
		render(
			<ImagePreview
				open
				images={images}
				alts={alts}
				onIndexChange={onIndexChange}
				onClose={onClose}
			/>,
		);
		await image("湖畔");
		swipe(-30);
		swipe(-100, 200);
		swipe(-200, 0, true);
		expect(onIndexChange).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});

	it("第二根手指介入会取消单指切图", async () => {
		const onIndexChange = vi.fn();
		render(
			<ImagePreview
				open
				images={images}
				alts={alts}
				onIndexChange={onIndexChange}
				onClose={() => {}}
			/>,
		);
		await image("湖畔");
		const target = stage();
		fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: 500, clientY: 400 });
		fireEvent.pointerMove(target, { pointerId: 1, clientX: 300, clientY: 400 });
		fireEvent.pointerDown(target, {
			button: 0,
			pointerId: 2,
			isPrimary: false,
			clientX: 600,
			clientY: 400,
		});
		fireEvent.pointerUp(target, { pointerId: 1, clientX: 300, clientY: 400 });
		expect(onIndexChange).not.toHaveBeenCalled();
	});

	it("放大后拖动只平移，重置后恢复切图", async () => {
		render(<Harness />);
		const original = await image("湖畔");
		fireEvent.keyDown(window, { key: "+" });
		swipe(-200);
		expect(stage().querySelector("img[alt='湖畔']")).toBe(original);
		fireEvent.doubleClick(original);
		swipe(-200);
		expect(await image("山峰")).not.toBeNull();
	});
});
