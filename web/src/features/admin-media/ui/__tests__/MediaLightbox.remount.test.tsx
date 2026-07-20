/**
 * MediaLightbox 全屏预览期间 Dialog 稳定性回归测试。
 *
 * 回归背景:打开/关闭全屏图片预览时,MediaLightbox 切换 Modal 的 modal prop,
 * 而 Radix Dialog 内部按 modal 分别渲染 DialogContentModal/DialogContentNonModal
 * 两个不同组件——prop 变化即整棵 Dialog 子树卸载重挂载:
 * 1) Dialog 内容的进场动画(缩放+淡入)重新播放一次;
 * 2) ContentImage 的 decoded 状态丢失,图片重新预载闪烁。
 * 修复:modal 保持恒定 true,不再随全屏开关切换。
 */
import type { MediaFile } from "@entities/media/model/types";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaLightbox } from "../MediaLightbox";

// ContentImage 预载与 ImagePreview 比例探测都走 new Image(),jsdom 中让其立即成功
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

const imageFile: MediaFile = {
    id: "f1",
    owner_id: "u1",
    purpose: "material",
    original_name: "photo.jpg",
    url: "/uploads/material/photo.jpg",
    size: 1024,
    mime_type: "image/jpeg",
    thumbnail: "/uploads/material/photo_thumb.jpg",
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
};

describe("MediaLightbox 全屏预览期间 Dialog 稳定性", () => {
    const originalImage = global.Image;

    beforeEach(() => {
        vi.stubGlobal("Image", MockImage as unknown as typeof Image);
    });

    afterEach(() => {
        cleanup(); // 无全局自动 cleanup,portal 残留会串扰后续用例
        vi.stubGlobal("Image", originalImage);
    });

    it("打开全屏图片预览不应导致 Dialog Content 重挂载(动画重播/图片重载)", async () => {
        render(
            <MediaLightbox
                open
                onOpenChange={() => {}}
                files={[imageFile]}
                index={0}
                onIndexChange={() => {}}
            />,
        );

        const dialogBefore = await waitFor(() => {
            const el = document.querySelector("[role=dialog]");
            expect(el).not.toBeNull();
            return el as HTMLElement;
        });

        // ContentImage 预载完成后出现「点击全屏预览」按钮,点击打开全屏
        const zoomButton = await waitFor(
            () => {
                const el = document.querySelector("[title='点击全屏预览']");
                expect(el).not.toBeNull();
                return el as HTMLElement;
            },
            { timeout: 3000 },
        );
        fireEvent.click(zoomButton);

        // 全屏预览层已打开
        await waitFor(() => {
            expect(document.querySelector("[class*='z-9999']")).not.toBeNull();
        });

        // 关键断言:Dialog Content 仍是同一个 DOM 元素(未因 modal 切换重挂载)
        const dialogAfter = document.querySelector("[role=dialog]");
        expect(dialogAfter).toBe(dialogBefore);
    });
});
