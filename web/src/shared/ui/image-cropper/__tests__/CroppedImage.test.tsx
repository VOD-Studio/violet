/**
 * CroppedImage 选区复现测试
 *
 * 契约:带 ?crop= 的 src 渲染后,容器内可见的图片区域必须等于选区
 * (选区宽高比与容器一致时)。反解逻辑独立于组件实现:
 * - absolute 定位模式:由 left/top/width/height 反解可见窗口
 * - object-position 模式(遗留):按 CSS cover 规范模拟可见窗口
 */
import { cleanup, fireEvent, render } from "@testing-library/react";
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
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        width: BOX.w,
        height: BOX.h,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: BOX.w,
        bottom: BOX.h,
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
});
