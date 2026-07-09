/**
 * ImageGrid 组件测试
 *
 * 验证不同图片数量的布局和 +N 遮罩。
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ImageGrid } from "../ImageGrid";

describe("ImageGrid", () => {
    afterEach(() => {
        cleanup();
    });

    it("空数组不渲染", () => {
        const { container } = render(<ImageGrid images={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it("1 张图：单列布局", () => {
        const { container } = render(
            <ImageGrid images={[{ url: "/a.jpg" }]} />,
        );
        const grid = container.querySelector(".grid");
        expect(grid?.className).toContain("grid-cols-1");
        expect(grid?.className).toContain("max-w-60");
    });

    it("2 张图：双列布局", () => {
        const { container } = render(
            <ImageGrid images={[{ url: "/a.jpg" }, { url: "/b.jpg" }]} />,
        );
        const grid = container.querySelector(".grid");
        expect(grid?.className).toContain("grid-cols-2");
    });

    it("3 张图：三列布局", () => {
        const images = Array.from({ length: 3 }, (_, i) => ({ url: `/${i}.jpg` }));
        const { container } = render(<ImageGrid images={images} />);
        const grid = container.querySelector(".grid");
        expect(grid?.className).toContain("grid-cols-3");
    });

    it("9 张图：全显示无遮罩", () => {
        const images = Array.from({ length: 9 }, (_, i) => ({ url: `/${i}.jpg` }));
        const { container } = render(<ImageGrid images={images} />);
        const imgs = container.querySelectorAll("img");
        expect(imgs.length).toBe(9);
        const overlay = container.querySelector(".bg-black\\/50");
        expect(overlay).toBeNull();
    });

    it("10 张图：显示前 9 张 + +N 遮罩", () => {
        const images = Array.from({ length: 10 }, (_, i) => ({ url: `/${i}.jpg` }));
        const { container } = render(<ImageGrid images={images} />);
        const imgs = container.querySelectorAll("img");
        expect(imgs.length).toBe(9);
        const overlay = container.querySelector(".bg-black\\/50");
        expect(overlay).toBeTruthy();
        expect(overlay?.textContent).toContain("+1");
    });

    it("缩略图优先使用 thumbnail", () => {
        const { container } = render(
            <ImageGrid images={[{ url: "/full.jpg", thumbnail: "/thumb.jpg" }]} />,
        );
        const img = container.querySelector("img");
        expect(img?.getAttribute("src")).toBe("/thumb.jpg");
    });
});
