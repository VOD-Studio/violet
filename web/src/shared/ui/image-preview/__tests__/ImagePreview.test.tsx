import { fireEvent, render, waitFor } from "@testing-library/react";
import { type ImgHTMLAttributes, type ReactNode, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImagePreview } from "../components/ImagePreview";

interface MotionDivProps {
    children?: ReactNode;
    onAnimationComplete?: () => void;
    [key: string]: unknown;
}

function MotionDiv({ children, onAnimationComplete, ...rest }: MotionDivProps) {
    // 模拟真实 motion：只在首次 mount 时触发一次动画完成回调，
    // 切换 index 不会重新 mount 外层容器，因此不会再次触发。
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

function MotionImg(props: ImgHTMLAttributes<HTMLImageElement>) {
    return <img alt="" {...props} />;
}

function AnimatePresenceWrapper({ children }: { children?: ReactNode }) {
    return <>{children}</>;
}

vi.mock("motion/react", () => ({
    motion: {
        div: MotionDiv,
        img: MotionImg,
    },
    AnimatePresence: AnimatePresenceWrapper,
}));

// jsdom 中需要让 Image 加载立即成功并带上 natural size
class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 1920;
    naturalHeight = 1080;
    #src = "";

    set src(value: string) {
        this.#src = value;
        queueMicrotask(() => this.onload?.());
    }

    get src() {
        return this.#src;
    }
}

describe("ImagePreview 图片组切换", () => {
    const originalImage = global.Image;

    beforeEach(() => {
        vi.stubGlobal("Image", MockImage as unknown as typeof Image);
    });

    afterEach(() => {
        vi.stubGlobal("Image", originalImage);
    });

    it("切换图片时应加载下一张原图，而不是只显示缩略图", async () => {
        const images = ["/img1.jpg", "/img2.jpg"];
        const thumbnails = ["/thumb1.jpg", "/thumb2.jpg"];

        render(
            <ImagePreview
                open
                onClose={() => {}}
                images={images}
                thumbnails={thumbnails}
                currentIndex={0}
            />,
        );

        // 等待第一张原图加载完成
        await waitFor(() => {
            const mainImages = Array.from(document.querySelectorAll("img.object-contain")).filter(
                (el): el is HTMLImageElement => el instanceof HTMLImageElement,
            );
            expect(mainImages.some((img) => img.src.includes("/img1.jpg"))).toBe(true);
        });

        // 通过键盘切换到第二张
        fireEvent.keyDown(window, { key: "ArrowRight" });

        // 关键断言：主显示区必须加载第二张原图，而非仅停留在缩略图层
        await waitFor(() => {
            const mainImages = Array.from(document.querySelectorAll("img.object-contain")).filter(
                (el): el is HTMLImageElement => el instanceof HTMLImageElement,
            );
            expect(mainImages.some((img) => img.src.includes("/img2.jpg"))).toBe(true);
        });
    });
});
