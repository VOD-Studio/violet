/**
 * CroppedImage 选区复现测试
 *
 * 契约:带 ?crop= 的 src 从服务端首帧起就以选区几何可见,容器内可见的
 * 图片区域等于选区(选区宽高比与容器一致时),水合、测量、加载后几何不变。
 * 反解逻辑独立于组件实现:按 CSS 规范模拟百分比 img 盒上的
 * object-fit:cover + object-position。
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CroppedImage } from "../CroppedImage";
import type { CropRect } from "../types";

interface Size {
	w: number;
	h: number;
}

/** 竖版 GIF 原图尺寸(480x800)与 16/9 容器(800x450) */
const NATURAL: Size = { w: 480, h: 800 };
const BOX: Size = { w: 800, h: 450 };

const percent = (value: string) => Number.parseFloat(value) / 100;

/** 从组件实际发出的 img style 反解容器内可见的归一化图片区域 */
function windowFromImgStyle(style: CSSStyleDeclaration, natural = NATURAL, box = BOX): CropRect {
	expect(style.objectFit).toBe("cover");
	const frame = { w: box.w * percent(style.width), h: box.h * percent(style.height) };
	const frameLeft = box.w * percent(style.left);
	const frameTop = box.h * percent(style.top);
	// object-fit 把图裁在 img 盒内:盒必须盖住容器,否则露出空白
	expect(frameLeft).toBeLessThanOrEqual(1e-6);
	expect(frameTop).toBeLessThanOrEqual(1e-6);
	expect(frameLeft + frame.w).toBeGreaterThanOrEqual(box.w - 1e-6);
	expect(frameTop + frame.h).toBeGreaterThanOrEqual(box.h - 1e-6);
	const scale = Math.max(frame.w / natural.w, frame.h / natural.h);
	const width = natural.w * scale;
	const height = natural.h * scale;
	const [px, py] = style.objectPosition.split(" ").map(percent);
	const left = frameLeft + (frame.w - width) * px;
	const top = frameTop + (frame.h - height) * py;
	return { x: -left / width, y: -top / height, w: box.w / width, h: box.h / height };
}

function mockContainerBox(box = BOX) {
	vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(box.w);
	vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(box.h);
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
		width: box.w * 0.94,
		height: box.h * 0.94,
		x: 0,
		y: 0,
		top: 0,
		left: 0,
		right: box.w * 0.94,
		bottom: box.h * 0.94,
		toJSON: () => ({}),
	} as DOMRect);
}

function cropSrc(rect: CropRect, path = "/uploads/t.gif") {
	return `${path}?crop=${rect.x},${rect.y},${rect.w},${rect.h}`;
}

function loadImage(img: HTMLImageElement, natural = NATURAL) {
	Object.defineProperty(img, "naturalWidth", { value: natural.w, configurable: true });
	Object.defineProperty(img, "naturalHeight", { value: natural.h, configurable: true });
	fireEvent.load(img);
}

function renderCropped(rect: CropRect) {
	const { container } = render(<CroppedImage src={cropSrc(rect)} aspect={16 / 9} alt="封面" />);
	const img = container.querySelector("img");
	if (!img) throw new Error("未渲染 img");
	loadImage(img);
	return img;
}

function serverImage(ui: ReactElement) {
	const html = renderToString(ui);
	const img = new DOMParser().parseFromString(html, "text/html").querySelector("img");
	if (!img) throw new Error("服务端未渲染 img");
	return { html, img };
}

function expectWindow(actual: CropRect, expected: CropRect) {
	expect(actual.x).toBeCloseTo(expected.x, 3);
	expect(actual.y).toBeCloseTo(expected.y, 3);
	expect(actual.w).toBeCloseTo(expected.w, 3);
	expect(actual.h).toBeCloseTo(expected.h, 3);
}

describe("CroppedImage 选区复现", () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("服务端首帧:带选区的封面可见,几何是相对容器的百分比", () => {
		const { html, img } = serverImage(
			<CroppedImage
				src="/uploads/cover.webp?crop=0.25,0.25,0.5,0.5"
				width={920}
				widths={[360, 720, 920, 1840]}
				aspect={2}
				loading="eager"
				fetchPriority="high"
				alt="封面"
			/>,
		);
		expect(html).not.toContain("visibility");
		expect(html).toContain("aspect-ratio:2");
		// 选区占原图正中一半:img 盒是容器的 2 倍,左上各退半个容器
		expect(img.style.width).toBe("200%");
		expect(img.style.height).toBe("200%");
		expect(img.style.left).toBe("-50%");
		expect(img.style.top).toBe("-50%");
		expect(img.style.objectFit).toBe("cover");
		expect(img.style.objectPosition).toBe("50% 50%");
	});

	it("悬停缩放原点与可见区域中心对齐", () => {
		const { img } = serverImage(
			<CroppedImage
				src={cropSrc({ x: 0.6, y: 0.6, w: 0.4, h: 0.4 })}
				aspect={2}
				alt="封面"
			/>,
		);
		// img 盒比容器大，调用方的 group-hover:scale 若绕盒中心缩放会明显偏移；
		// 原点必须落在可见区域中心，即与 object-position 同值。
		expect(img.style.transformOrigin).toBe("80% 80%");
		expect(img.style.transformOrigin).toBe(img.style.objectPosition);
	});

	it.each([
		[
			"选区比例与容器不同",
			{ aspect: 2 },
			{ w: 800, h: 400 },
			// 按宽缩放 800/480:可见高 400/(800/480) = 240px = 0.3,中心 y = 0.66875
			{ x: 0, y: 0.51875, w: 1, h: 0.3 },
		],
		[
			"fillContainer",
			{ fillContainer: true, className: "absolute inset-0" },
			{ w: 450, h: 800 },
			// 按高缩放 800/270:可见宽 450/(800/270) = 151.875px = 0.31640625,中心 x = 0.5
			{ x: 0.341796875, y: 0.5, w: 0.31640625, h: 0.3375 },
		],
	] as const)("服务端首帧:%s 时同样可见且选区居中铺满", (_name, props, box, expected) => {
		// 竖图 480x800 上的 16/9 全宽选区:像素 480x270
		const rect: CropRect = { x: 0, y: 0.5, w: 1, h: 0.3375 };
		const { html, img } = serverImage(
			<CroppedImage src={cropSrc(rect)} alt="封面" {...props} />,
		);
		expect(html).not.toContain("visibility");
		expectWindow(windowFromImgStyle(img.style, NATURAL, box), expected);
	});

	it("水合、测量与加载完成后沿用首帧几何", () => {
		mockContainerBox();
		const ui = (
			<CroppedImage
				src={cropSrc({ x: 0.25, y: 0.4, w: 0.5, h: 0.16875 })}
				aspect={16 / 9}
				alt="封面"
			/>
		);
		const container = document.body.appendChild(document.createElement("div"));
		container.innerHTML = renderToString(ui);
		const img = container.querySelector("img");
		if (!img) throw new Error("服务端未渲染 img");
		const firstFrame = img.getAttribute("style");
		expect(firstFrame).toContain("%");

		render(ui, { container, hydrate: true });
		loadImage(img);

		expect(container.querySelector("img")).toBe(img);
		expect(img.getAttribute("style")).toBe(firstFrame);
	});

	it("16/9 全宽选区在 16/9 容器中精确复现(用户场景)", () => {
		mockContainerBox();
		// 竖图 480x800 上的 16/9 全宽选区:h = (9/16) * (480/800) = 0.3375
		const rect: CropRect = { x: 0, y: 0.5, w: 1, h: 0.3375 };
		const img = renderCropped(rect);
		expectWindow(windowFromImgStyle(img.style), rect);
	});

	it("16/9 局部选区在 16/9 容器中精确复现", () => {
		mockContainerBox();
		// w=0.5 → h = 0.5 * (9/16) * 0.6 = 0.16875
		const rect: CropRect = { x: 0.25, y: 0.4, w: 0.5, h: 0.16875 };
		const img = renderCropped(rect);
		expectWindow(windowFromImgStyle(img.style), rect);
	});

	it("fillContainer 不写 inline aspect-ratio 且选区复现不受影响", () => {
		mockContainerBox();
		// 回归:WovenBento 主格 bug——absolute inset-0 容器 height:auto 下,
		// inline 选区比例会劫持高度(格子 331px 高只显示 114px)。
		// 契约:fillContainer 时容器尺寸完全由调用方 className 决定。
		const rect: CropRect = { x: 0, y: 0.5, w: 1, h: 0.3375 };
		const ui = (
			<CroppedImage
				src={cropSrc(rect)}
				fillContainer
				className="absolute inset-0"
				alt="封面"
			/>
		);
		// jsdom 不实现 aspect-ratio,容器比例只能从服务端 HTML 断言
		expect(renderToStaticMarkup(ui)).not.toContain("aspect-ratio");
		const img = render(ui).container.querySelector("img");
		if (!img) throw new Error("未渲染 img");
		loadImage(img);
		expectWindow(windowFromImgStyle(img.style), rect);
	});

	it("加载失败时渲染占位,不留下破图", () => {
		mockContainerBox();
		const onError = vi.fn();
		const { container, getByRole } = render(
			<CroppedImage
				src="/uploads/cover.webp?crop=0.25,0.25,0.5,0.5"
				aspect={2}
				alt="封面"
				onError={onError}
			/>,
		);
		const img = container.querySelector("img");
		if (!img) throw new Error("未渲染 img");
		fireEvent.error(img);

		expect(container.querySelector("img")).toBeNull();
		const placeholder = getByRole("img", { name: "封面" });
		expect(placeholder.querySelector("svg")).not.toBeNull();
		expect(onError).toHaveBeenCalledTimes(1);
	});

	it("水合前已加载完成的候选在测量后继续复用,不改请求较小档位", () => {
		// 342px 容器、DPR 1、选区占原图一半宽:测量后只需 684px,对应 720 档
		mockContainerBox({ w: 342, h: 171 });
		vi.stubGlobal("devicePixelRatio", 1);
		const ui = (
			<CroppedImage
				src="/uploads/a.png?crop=0.25,0.25,0.5,0.5"
				width={920}
				widths={[360, 720, 920, 1840]}
				aspect={2}
				loading="eager"
				alt="封面"
			/>
		);
		const container = document.body.appendChild(document.createElement("div"));
		container.innerHTML = renderToString(ui);
		const img = container.querySelector("img");
		if (!img) throw new Error("服务端未渲染 img");
		const loaded = `${window.location.origin}/uploads/a.png?crop=0.25%2C0.25%2C0.5%2C0.5&w=1840&format=webp&quality=80`;
		Object.defineProperty(img, "complete", { value: true, configurable: true });
		Object.defineProperty(img, "currentSrc", { value: loaded, configurable: true });
		Object.defineProperty(img, "naturalWidth", { value: 1840, configurable: true });
		Object.defineProperty(img, "naturalHeight", { value: 920, configurable: true });

		render(ui, { container, hydrate: true });

		expect(img.getAttribute("src")).toBe(loaded);
		expect(container.querySelectorAll("source")).toHaveLength(0);
		expect(img.style.width).toBe("200%");
	});

	it("首屏保留 eager/high，SSR 候选不伪造素材像素宽度", () => {
		const html = renderToStaticMarkup(
			<CroppedImage
				src="/uploads/cover.webp"
				width={920}
				widths={[360, 720, 920, 1840]}
				loading="eager"
				fetchPriority="high"
				aspect={2}
				alt="首屏"
			/>,
		);
		const doc = new DOMParser().parseFromString(html, "text/html");
		const image = doc.querySelector("img");
		expect(image?.getAttribute("loading")).toBe("eager");
		expect(image?.getAttribute("fetchpriority")).toBe("high");
		expect(image?.getAttribute("decoding")).toBe("async");
		expect(image?.hasAttribute("srcset")).toBe(false);
		const sources = doc.querySelectorAll("source");
		expect(sources.length).toBeGreaterThan(0);
		for (const source of sources) {
			expect(source.srcset).not.toMatch(/\s\d+(?:w|x)(?:,|$)/);
		}
	});

	it("裁剪候选保留完整源图，并按选区宽度提供足够像素", () => {
		mockContainerBox();
		const { getByAltText } = render(
			<CroppedImage
				src="/uploads/a.png?crop=0.25,0.25,0.5,0.5&thumb=200x200"
				width={920}
				widths={[360, 720, 920, 1840]}
				aspect={2}
				alt="局部裁剪"
			/>,
		);
		const image = getByAltText("局部裁剪");
		expect(image.getAttribute("src")).toContain("w=1840");
		expect(image.getAttribute("srcset")).toBeNull();
		expect(image.getAttribute("src")).not.toContain("thumb");
		expect(decodeURIComponent(image.getAttribute("src") ?? "")).toContain(
			"crop=0.25,0.25,0.5,0.5",
		);
	});

	it("极小选区候选不超过接口宽度限制，也不重复生成相同候选", () => {
		mockContainerBox();
		const { getByAltText } = render(
			<CroppedImage
				src="/uploads/a.png?crop=0.1,0.1,0.01,0.01"
				width={920}
				widths={[360, 920, 1840]}
				aspect={2}
				alt="极小选区"
			/>,
		);
		const image = getByAltText("极小选区");
		expect(image.getAttribute("src")).toContain("w=4096");
		expect(image.getAttribute("srcset")).toBeNull();
	});

	it.each([1, 2])("无作者选区也按 cover 放大倍率与 DPR=%i 请求足够像素", (density) => {
		vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(342);
		vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(171);
		vi.stubGlobal("devicePixelRatio", density);
		const { getByAltText } = render(
			<CroppedImage
				src="/uploads/panorama.png"
				width={920}
				widths={[360, 720, 920, 1840]}
				aspect={2}
				alt="宽幅封面"
			/>,
		);
		const image = getByAltText("宽幅封面");
		Object.defineProperty(image, "currentSrc", {
			value: "https://example.com/uploads/panorama.png?w=360&format=webp&quality=80",
			configurable: true,
		});
		Object.defineProperty(image, "naturalWidth", { value: 360, configurable: true });
		Object.defineProperty(image, "naturalHeight", { value: 90, configurable: true });
		fireEvent.load(image);
		const request = new URL(image.getAttribute("src") ?? "", "https://example.com");
		expect(Number(request.searchParams.get("w"))).toBe(density === 1 ? 720 : 1840);
		expect(Number(request.searchParams.get("w"))).toBeGreaterThanOrEqual(684 * density);
	});
});
