/**
 * ImagePreview 原图加载兜底回归测试。
 *
 * 回归背景:原图加载此前唯一门控是飞入动画的 onAnimationComplete 回调。
 * 动画回调不是可靠事件源(后台标签页 rAF 冻结、动画被中断/跳过时均不触发),
 * 一旦不触发,原图永不加载,预览永久停在缩略图(?w=600)。
 * 修复:增加超时兜底,回调与定时器先到先触发。
 * 本测试 mock motion 使其【永不】调用 onAnimationComplete,验证兜底生效。
 */
import { act, render } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImagePreview } from "../components/ImagePreview";

// 与真实场景一致的最坏情况:onAnimationComplete 永不触发
function MotionDiv({ children, ...rest }: { children?: ReactNode; [key: string]: unknown }) {
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
    return <img alt="" {...props} />;
}

function AnimatePresenceWrapper({ children }: { children?: ReactNode }) {
    return <>{children}</>;
}

vi.mock("motion/react", () => ({
    motion: { div: MotionDiv, img: MotionImg },
    AnimatePresence: AnimatePresenceWrapper,
}));

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

describe("ImagePreview 原图加载兜底", () => {
    const originalImage = global.Image;

    beforeEach(() => {
        vi.stubGlobal("Image", MockImage as unknown as typeof Image);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.stubGlobal("Image", originalImage);
    });

    it("onAnimationComplete 永不触发时,兜底定时器仍加载原图", async () => {
        render(
            <ImagePreview
                open
                onClose={() => {}}
                images={["/uploads/a.png"]}
                thumbnails={["/uploads/a.png?w=600&format=webp"]}
                currentIndex={0}
            />,
        );

        // probe 完成(queueMicrotask)→ box 就绪
        await act(async () => {});

        // 兜底超时尚未到:原图未挂载(仍受门控)
        expect(document.querySelector("img.object-contain")).toBeNull();

        // 推进到兜底超时(动画 0.3s + 余量):原图必须挂载
        await act(async () => {
            vi.advanceTimersByTime(600);
        });
        expect(document.querySelector("img.object-contain")).not.toBeNull();
    });
});
