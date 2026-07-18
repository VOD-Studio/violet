/**
 * ImagePreview 预览占位层测试
 *
 * 契约:
 * 1. 占位缩略图 object-cover 显示——方形/异比例缩略图不被拉伸变形
 * 2. 预览容器按缩略图(已被格子缓存,探测即时)就绪,不等原图下载解码——
 *    原图(可达 15MB)慢加载不阻塞飞入动画
 * 3. 无缩略图时回退探测原图(保护旧路径)
 */
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImagePreview } from "../components/ImagePreview";

/** 缩略图(400x600 保比例)立即可用;原图(15MB 竖版)按 slowOriginal 控制是否响应 */
function stubProbeImage({ slowOriginal }: { slowOriginal: boolean }) {
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
                queueMicrotask(() => this.onload?.());
            } else if (!slowOriginal) {
                this.naturalWidth = 2238;
                this.naturalHeight = 3268;
                queueMicrotask(() => this.onload?.());
            }
        }

        get src() {
            return this.#src;
        }
    }
    vi.stubGlobal("Image", ProbeImage as unknown as typeof Image);
}

/** jsdom 视口 1024x768 → 90vw x 90vh 盒内按比例 contain 的期望尺寸 */
function expectContainBox(el: HTMLElement, ratioW: number, ratioH: number) {
    const maxW = window.innerWidth * 0.9;
    const maxH = window.innerHeight * 0.9;
    const w1 = maxH * (ratioW / ratioH);
    const fit = w1 <= maxW ? { width: w1, height: maxH } : { width: maxW, height: maxW / (ratioW / ratioH) };
    expect(Number.parseFloat(el.style.width)).toBeCloseTo(fit.width, 1);
    expect(Number.parseFloat(el.style.height)).toBeCloseTo(fit.height, 1);
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
        stubProbeImage({ slowOriginal: false });
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

    it("原图慢加载时容器按缩略图比例就绪,不等原图", async () => {
        stubProbeImage({ slowOriginal: true });
        render(
            <ImagePreview
                open
                onClose={() => {}}
                images={["/uploads/b.jpg"]}
                thumbnails={["/uploads/b.jpg?w=400&format=webp"]}
                currentIndex={0}
            />,
        );
        // 原图 probe 永不返回:容器仍须按缩略图比例(2:3)就绪
        const { box } = await findPlaceholderAndBox();
        expectContainBox(box, 400, 600);
    });

    it("无缩略图时回退探测原图", async () => {
        stubProbeImage({ slowOriginal: false });
        render(
            <ImagePreview open onClose={() => {}} images={["/uploads/b.jpg"]} currentIndex={0} />,
        );
        // 无缩略图 → 无占位层;容器按原图比例(2238:3268)就绪
        const box = await waitFor(
            () => {
                const el = document.querySelector<HTMLElement>("[style*='width']");
                expect(el).not.toBeNull();
                return el as HTMLElement;
            },
            { timeout: 3000 },
        );
        expectContainBox(box, 2238, 3268);
    });
});
