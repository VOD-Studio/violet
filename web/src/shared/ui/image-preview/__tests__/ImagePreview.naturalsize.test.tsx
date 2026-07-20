/**
 * ImagePreview 原图尺寸显示盒回归测试。
 *
 * 回归背景:预览容器此前只按「比例 + 90vw×90vh」计算显示盒,不做原图
 * natural 上限——小于视口的图被强制放大到视口盒显示(模糊失真),且尺寸
 * 探测用的是缩略图(w=1200),父组件永远拿不到原图真实尺寸。
 * 契约:
 * 1. 原图 natural 尺寸小于视口盒时,按原图大小显示(不放大)
 * 2. 有缩略图占位时,飞入盒先按缩略图比例就绪;原图加载完成后以其
 *    natural 尺寸修正显示盒
 * 3. 原图大于视口时仍按 90vw×90vh contain 缩小(不溢出视口)
 */
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { type ReactNode, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImagePreview } from "../components/ImagePreview";

interface MotionDivProps {
    children?: ReactNode;
    onAnimationComplete?: () => void;
    [key: string]: unknown;
}

function MotionDiv({ children, onAnimationComplete, ...rest }: MotionDivProps) {
    // 首次 mount 即触发飞入完成,让原图 <img> 立即挂载(同 ImagePreview.test.tsx)
    const hasCompleted = useRef(false);
    if (!hasCompleted.current) {
        hasCompleted.current = true;
        onAnimationComplete?.();
    }
    const safeProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
        if (
            key.startsWith("on") ||
            ["className", "style", "role", "aria-label", "aria-hidden", "title", "id"].includes(key)
        ) {
            safeProps[key] = value;
        }
    }
    return <div {...safeProps}>{children}</div>;
}

function MotionImg(props: Record<string, unknown>) {
    const { initial, animate, exit, transition, whileDrag, ...domProps } = props;
    return <img alt="" {...domProps} />;
}

function AnimatePresenceWrapper({ children }: { children?: ReactNode }) {
    return <>{children}</>;
}

vi.mock("motion/react", () => ({
    motion: { div: MotionDiv, img: MotionImg },
    AnimatePresence: AnimatePresenceWrapper,
}));

/** probe(new Image())按 URL 返回预设尺寸:缩略图 1200x675,小图 400x300,大图 4000x3000 */
class ProbeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 0;
    naturalHeight = 0;
    #src = "";

    set src(value: string) {
        this.#src = value;
        if (value.includes("w=1200")) {
            this.naturalWidth = 1200;
            this.naturalHeight = 675;
        } else if (value.includes("small")) {
            this.naturalWidth = 400;
            this.naturalHeight = 300;
        } else if (value.includes("huge")) {
            this.naturalWidth = 4000;
            this.naturalHeight = 3000;
        }
        queueMicrotask(() => this.onload?.());
    }

    get src() {
        return this.#src;
    }
}

/** 找到带显式 width 的预览容器 */
async function findBox(): Promise<HTMLElement> {
    return waitFor(
        () => {
            const el = document.querySelector<HTMLElement>("[style*='width']");
            expect(el, "未找到显式尺寸容器").not.toBeNull();
            return el as HTMLElement;
        },
        { timeout: 3000 },
    );
}

function expectBoxSize(box: HTMLElement, width: number, height: number) {
    expect(Number.parseFloat(box.style.width)).toBeCloseTo(width, 1);
    expect(Number.parseFloat(box.style.height)).toBeCloseTo(height, 1);
}

/** jsdom 视口 1024x768 → 90vw×90vh 盒内按比例 contain 的期望尺寸 */
function expectViewportContainBox(box: HTMLElement, ratioW: number, ratioH: number) {
    const maxW = window.innerWidth * 0.9;
    const maxH = window.innerHeight * 0.9;
    const w1 = maxH * (ratioW / ratioH);
    const fit =
        w1 <= maxW
            ? { width: w1, height: maxH }
            : { width: maxW, height: maxW / (ratioW / ratioH) };
    expectBoxSize(box, fit.width, fit.height);
}

describe("ImagePreview 原图尺寸显示盒", () => {
    const originalImage = global.Image;

    beforeEach(() => {
        vi.stubGlobal("Image", ProbeImage as unknown as typeof Image);
    });

    afterEach(() => {
        cleanup(); // 无全局自动 cleanup,portal 残留会串扰后续用例
        vi.stubGlobal("Image", originalImage);
    });

    it("原图小于视口盒时按 natural 尺寸显示,不放大", async () => {
        render(
            <ImagePreview
                open
                onClose={() => {}}
                images={["/uploads/small.jpg"]}
                currentIndex={0}
            />,
        );
        const box = await findBox();
        expectBoxSize(box, 400, 300);
    });

    it("原图加载完成后,显示盒从缩略图比例盒修正为原图 natural 尺寸", async () => {
        render(
            <ImagePreview
                open
                onClose={() => {}}
                images={["/uploads/small.jpg"]}
                thumbnails={["/uploads/small.jpg?w=1200&format=webp"]}
                currentIndex={0}
            />,
        );

        // 飞入阶段:按缩略图(1200x675)比例的视口 contain 盒就绪
        const box = await findBox();
        expectViewportContainBox(box, 1200, 675);

        // 原图加载完成(natural 400x300)→ 显示盒修正为原图大小
        const original = (await waitFor(() => {
            const el = document.querySelector("img.object-contain");
            expect(el).not.toBeNull();
            return el;
        })) as HTMLImageElement;
        Object.defineProperty(original, "naturalWidth", { value: 400 });
        Object.defineProperty(original, "naturalHeight", { value: 300 });
        fireEvent.load(original);

        await waitFor(() => expectBoxSize(box, 400, 300));
    });

    it("原图大于视口时仍按 90vw×90vh contain 缩小", async () => {
        render(
            <ImagePreview
                open
                onClose={() => {}}
                images={["/uploads/huge.jpg"]}
                currentIndex={0}
            />,
        );
        const box = await findBox();
        expectViewportContainBox(box, 4000, 3000);
    });
});
