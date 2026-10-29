/**
 * CroppedImage 选区复现测试
 *
 * 契约:带 ?crop= 的 src 渲染后,容器内可见的图片区域必须等于选区
 * (选区宽高比与容器一致时)。反解逻辑独立于组件实现:
 * - absolute 定位模式:由 left/top/width/height 反解可见窗口
 * - object-position 模式(遗留):按 CSS cover 规范模拟可见窗口
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
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

/** CSS object-fit:cover + object-position 的规范行为模拟 */
function legacyCoverWindow(px: number, py: number): CropRect {
	const ai = NATURAL.w / NATURAL.h;
	const ac = BOX.w / BOX.h;
	const winW = ai < ac ? 1 : ac / ai;
	const winH = ai < ac ? ai / ac : 1;
	return { x: px * (1 - winW), y: py * (1 - winH), w: winW, h: winH };
}

/** 从组件实际发出的 img style 反解容器内可见的归一化图片区域 */
function windowFromImgStyle(style: CSSStyleDeclaration): CropRect {
	// 显式几何模式:组件发 inline width/height/left/top(position 由 class 决定,不算契约)
	if (style.width !== "") {
		const width = Number.parseFloat(style.width);
		const height = Number.parseFloat(style.height);
		const left = Number.parseFloat(style.left);
		const top = Number.parseFloat(style.top);
		const x = Math.min(Math.max(-left / width, 0), 1);
		const y = Math.min(Math.max(-top / height, 0), 1);
		const r = Math.min(Math.max((BOX.w - left) / width, 0), 1);
		const b = Math.min(Math.max((BOX.h - top) / height, 0), 1);
		return { x, y, w: r - x, h: b - y };
	}
	const [px, py] = style.objectPosition.split(" ").map((v) => Number.parseFloat(v) / 100);
	return legacyCoverWindow(px, py);
}

function mockContainerBox() {
	vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(BOX.w);
	vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(BOX.h);
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
		width: BOX.w * 0.94,
		height: BOX.h * 0.94,
		x: 0,
		y: 0,
		top: 0,
		left: 0,
		right: BOX.w * 0.94,
		bottom: BOX.h * 0.94,
		toJSON: () => ({}),
	} as DOMRect);
}

function renderCropped(rect: CropRect) {
	const src = `/uploads/t.gif?crop=${rect.x},${rect.y},${rect.w},${rect.h}`;
	const { container } = render(<CroppedImage src={src} aspect={16 / 9} alt="封面" />);
	const img = container.querySelector("img");
	if (!img) throw new Error("未渲染 img");
	Object.defineProperty(img, "naturalWidth", { value: NATURAL.w, configurable: true });
	Object.defineProperty(img, "naturalHeight", { value: NATURAL.h, configurable: true });
	fireEvent.load(img);
	return img;
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
		const src = `/uploads/t.gif?crop=${rect.x},${rect.y},${rect.w},${rect.h}`;
		const { container } = render(
			<CroppedImage src={src} fillContainer className="absolute inset-0" alt="封面" />,
		);
		const div = container.firstElementChild as HTMLDivElement;
		expect(div.style.aspectRatio).toBe("");
		// 选区按容器(而非选区比例)cover 复现,transform 几何照常发出
		const img = div.querySelector("img");
		if (!img) throw new Error("未渲染 img");
		Object.defineProperty(img, "naturalWidth", { value: NATURAL.w, configurable: true });
		Object.defineProperty(img, "naturalHeight", { value: NATURAL.h, configurable: true });
		fireEvent.load(img);
		expectWindow(windowFromImgStyle(img.style), rect);
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
