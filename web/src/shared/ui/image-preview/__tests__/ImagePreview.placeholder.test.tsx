/**
 * ImagePreview 预览占位层测试
 *
 * 契约:占位缩略图 object-cover 显示——方形/异比例缩略图不被拉伸变形
 */
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImagePreview } from "../components/ImagePreview";

/** 缩略图(400x600 保比例)与原图(竖版)探测均立即成功 */
function stubProbeImage() {
    class ProbeImage {
        onload: (() => void) | null = null;
        naturalWidth = 0;
        naturalHeight = 0;
        #src = "";

        set src(value: string) {
            this.#src = value;
            if (value.includes("w=400")) {
                this.naturalWidth = 400;
                this.naturalHeight = 600;
            } else {
                this.naturalWidth = 2238;
                this.naturalHeight = 3268;
            }
            queueMicrotask(() => this.onload?.());
        }

        get src() {
            return this.#src;
        }
    }
    vi.stubGlobal("Image", ProbeImage as unknown as typeof Image);
}

/** 占位 img(src 含 w=400) → 向上找带显式 width 的容器 */
async function findPlaceholderAndBox() {
    const thumbImg = await waitFor(
        () => {
            const el = document.querySelector<HTMLImageElement>("img[src*='w=400']");
            expect(el).not.toBeNull();
            return el as HTMLImageElement;
        },
        { timeout: 3000 },
    );
    let box: HTMLElement | null = thumbImg;
    while (box && !box.style.width) box = box.parentElement;
    expect(box, "未找到显式尺寸容器").not.toBeNull();
    return { thumbImg, box: box as HTMLElement };
}

describe("ImagePreview 预览占位层", () => {
    const originalImage = global.Image;

    beforeEach(() => {
        document.body.innerHTML = "";
    });

    afterEach(() => {
        vi.stubGlobal("Image", originalImage);
    });

    it("占位缩略图用 object-cover 显示,不拉伸变形", async () => {
        stubProbeImage();
        render(
            <ImagePreview
                open
                onClose={() => {}}
                images={["/uploads/b.jpg"]}
                thumbnails={["/uploads/b.jpg?w=400&format=webp"]}
                currentIndex={0}
            />,
        );
        const { thumbImg } = await findPlaceholderAndBox();
        expect(thumbImg.className).toContain("object-cover");
        expect(thumbImg.className).not.toContain("object-fill");
    });
});
