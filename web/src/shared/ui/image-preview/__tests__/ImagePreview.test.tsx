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

	it("多图列表默认收起，可从工具栏显示并再次收起", async () => {
		render(<Harness />);
		await image("湖畔");
		const toggle = screen.getByRole("button", { name: "显示图片列表" });
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByRole("listbox", { name: "图片列表" })).toBeNull();

		fireEvent.click(toggle);
		expect(screen.getByRole("listbox", { name: "图片列表" })).not.toBeNull();
		const collapse = screen.getByRole("button", { name: "收起图片列表" });
		expect(collapse.getAttribute("aria-expanded")).toBe("true");
		fireEvent.click(collapse);
		await waitFor(() => expect(screen.queryByRole("listbox", { name: "图片列表" })).toBeNull());
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

	it("滚轮可从图片周围开始收回，但工具栏与缩略图保留自身滚动", async () => {
		const onClose = vi.fn();
		render(
			<ImagePreview
				open
				images={images}
				alts={alts}
				thumbnails={thumbnails}
				onClose={onClose}
			/>,
		);
		await image("湖畔");
		fireEvent.wheel(screen.getByTitle("左旋转"), { deltaY: 600 });
		fireEvent.click(screen.getByRole("button", { name: "显示图片列表" }));
		fireEvent.wheel(screen.getByAltText("缩略图 1"), { deltaY: 600 });
		expect(onClose).not.toHaveBeenCalled();
		fireEvent.wheel(stage(), { deltaY: -400 });
		fireEvent.wheel(stage(), { deltaY: -400 });
		expect(screen.getByText("100%")).not.toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
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

describe("ImagePreview 收回关闭", () => {
	const triggerRect = new DOMRect(100, 120, 200, 150);

	it("退出动画结束前保持滚动锁，结束后恢复页面滚动", async () => {
		const props = { images, alts, triggerRect, onClose: () => {} };
		const view = render(<ImagePreview open {...props} />);
		await image("湖畔");
		view.rerender(<ImagePreview open={false} {...props} />);
		expect(document.querySelector('[aria-label="图片预览"]')).not.toBeNull();
		expect(document.body.style.overflow).toBe("hidden");
		await waitFor(() => expect(document.querySelector('[aria-label="图片预览"]')).toBeNull());
		expect(document.body.style.overflow).toBe("");
	});

	it("退出期间重开不会被旧会话提前解除滚动锁", async () => {
		const props = { images, alts, triggerRect, onClose: () => {} };
		const view = render(<ImagePreview open {...props} />);
		await image("湖畔");
		const previous = screen.getByRole("dialog");
		view.rerender(<ImagePreview open={false} {...props} />);
		view.rerender(<ImagePreview open {...props} currentIndex={1} />);
		await image("山峰");
		await waitFor(() => expect(previous.isConnected).toBe(false));
		expect(document.body.style.overflow).toBe("hidden");
		view.rerender(<ImagePreview open={false} {...props} />);
		await waitFor(() => expect(document.querySelector('[aria-label="图片预览"]')).toBeNull());
		expect(document.body.style.overflow).toBe("");
	});

	it("从最后一张切到第一张关闭后，返回当前图片的入口", async () => {
		function Gallery() {
			const [preview, setPreview] = useState<{
				open: boolean;
				index: number;
				trigger: HTMLElement | null;
			}>({ open: false, index: 0, trigger: null });
			return (
				<article>
					{images.map((src, index) => (
						<button
							key={src}
							type="button"
							onClick={(event) =>
								setPreview({ open: true, index, trigger: event.currentTarget })
							}
						>
							<img
								src={src}
								alt={`浏览图 ${index + 1}`}
								ref={(element) => {
									if (element)
										element.getBoundingClientRect = () =>
											new DOMRect(100, 100 + index * 200, 200, 150);
								}}
							/>
						</button>
					))}
					<ImagePreview
						open={preview.open}
						images={images}
						alts={alts}
						currentIndex={preview.index}
						triggerElement={preview.trigger}
						onClose={() => setPreview((current) => ({ ...current, open: false }))}
						onIndexChange={(index) => setPreview((current) => ({ ...current, index }))}
					/>
				</article>
			);
		}
		render(<Gallery />);
		const first = screen.getByRole("button", { name: "浏览图 1" });
		fireEvent.click(screen.getByRole("button", { name: "浏览图 3" }));
		await image("海岸");
		fireEvent.keyDown(window, { key: "ArrowRight" });
		await image("湖畔");
		fireEvent.keyDown(window, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(document.activeElement).toBe(first);
	});

	it("周围区域可沿首次滚动方向收回，并用反向滚动恢复", async () => {
		const onClose = vi.fn();
		render(
			<ImagePreview
				open
				images={images}
				alts={alts}
				triggerRect={triggerRect}
				onClose={onClose}
			/>,
		);
		await image("湖畔");
		const background = stage();
		fireEvent.wheel(background, { deltaY: -300 });
		expect(onClose).not.toHaveBeenCalled();
		fireEvent.wheel(background, { deltaY: 300 });
		expect(onClose).not.toHaveBeenCalled();
		fireEvent.wheel(background, { deltaY: -600 });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("图片放大后，滚轮仍只控制收回而不改变缩放倍率", async () => {
		const onClose = vi.fn();
		render(
			<ImagePreview
				open
				images={images}
				alts={alts}
				triggerRect={triggerRect}
				onClose={onClose}
			/>,
		);
		const original = await image("湖畔");
		fireEvent.keyDown(window, { key: "+" });
		expect(screen.getByText("150%")).not.toBeNull();
		fireEvent.wheel(original, { deltaY: -200 });
		expect(screen.getByText("150%")).not.toBeNull();
		fireEvent.wheel(original, { deltaY: 150 });
		expect(screen.getByText("150%")).not.toBeNull();
		expect(onClose).not.toHaveBeenCalled();
		fireEvent.wheel(original, { deltaY: -550 });
		expect(screen.getByText("150%")).not.toBeNull();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("周围区域在图片离开指针后仍接管当前滚轮手势", async () => {
		const onClose = vi.fn();
		render(
			<ImagePreview
				open
				images={images}
				alts={alts}
				triggerRect={triggerRect}
				onClose={onClose}
			/>,
		);
		await image("湖畔");
		const background = stage();
		fireEvent.wheel(background, { deltaY: 300, clientX: 300, clientY: 300 });
		fireEvent.pointerMove(background, { clientX: 800, clientY: 600 });
		fireEvent.wheel(background, { deltaY: 300, clientX: 800, clientY: 600 });
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
	});
});
