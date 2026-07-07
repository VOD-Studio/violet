import { describe, expect, it } from "vitest";
import { cropToStyle } from "../crop-to-style";

describe("cropToStyle", () => {
    it("无选区返回单位 transform", () => {
        expect(cropToStyle(undefined, 16 / 9)).toEqual({
            transform: "translate(0%, 0%) scale(1)",
        });
    });

    it("正方形居中选区 + 正方形容器 scale=2", () => {
        const s = cropToStyle({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 1);
        expect(s.transform).toContain("scale(2)");
        expect(s.transform).toContain("translate(0%, 0%)");
    });

    it("宽选区 + 高容器按高度铺满 scale=2.5", () => {
        // 选区宽高比 0.8/0.4=2,容器 1:1,容器更窄 → 受限于高度 scale=1/0.4=2.5
        const s = cropToStyle({ x: 0.1, y: 0.3, w: 0.8, h: 0.4 }, 1);
        expect(s.transform).toContain("scale(2.5)");
    });

    it("高选区 + 宽容器按宽度铺满 scale=2.5", () => {
        // 选区宽高比 0.4/0.8=0.5,容器 16:9≈1.78,容器更宽 → 受限于宽度 scale=1/0.4=2.5
        const s = cropToStyle({ x: 0.3, y: 0.1, w: 0.4, h: 0.8 }, 16 / 9);
        expect(s.transform).toContain("scale(2.5)");
    });

    it("居中选区 translate 为 0%", () => {
        const s = cropToStyle({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 1);
        expect(s.transform).toContain("translate(0%, 0%)");
    });

    it("左上角选区 translate 让图片右下移(正百分比)", () => {
        const s = cropToStyle({ x: 0, y: 0, w: 0.5, h: 0.5 }, 1);
        // 选区中心 0.25,需 translate 把它对齐容器中心 → tx=ty=(0.5-0.25)*100=25
        expect(s.transform).toContain("translate(25%, 25%)");
    });

    it("右下角选区 translate 让图片左上移(负百分比)", () => {
        const s = cropToStyle({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, 1);
        // 选区中心 0.75,tx=ty=(0.5-0.75)*100=-25
        expect(s.transform).toContain("translate(-25%, -25%)");
    });
});
