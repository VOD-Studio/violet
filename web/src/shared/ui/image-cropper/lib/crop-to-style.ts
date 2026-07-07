import type { CSSProperties } from "react";
import type { CropRect } from "../types";

/**
 * 把归一化裁剪区域 + 容器宽高比,换算成 CSS transform。
 *
 * 原理(object-fit:cover 下的视觉聚焦):
 * - 容器套选区,选区要铺满容器,scale = max(1/w, 1/h) 按容器宽高比修正方向
 * - 选区中心对齐容器中心,translate 让图片反向移动
 *
 * 这样浏览器仍加载完整原图(GIF 动画保留),但视觉上聚焦到选区,
 * 实现无损的「视觉裁剪」。
 */
export function cropToStyle(
    rect: CropRect | undefined,
    containerAspect: number,
): Pick<CSSProperties, "transform"> {
    // 无选区:图片自然铺满(object-cover 已处理)
    if (!rect) {
        return { transform: "translate(0%, 0%) scale(1)" };
    }

    const rectAspect = rect.w / rect.h;
    // 选区比容器宽(选区宽高比 > 容器宽高比):高度铺满,scale = 1/h
    // 选区比容器高:宽度铺满,scale = 1/w
    const scale = rectAspect > containerAspect ? 1 / rect.h : 1 / rect.w;

    // 选区中心(归一化)相对图片中心(0.5)的偏移,转成图片自身百分比
    const centerX = rect.x + rect.w / 2;
    const centerY = rect.y + rect.h / 2;
    const tx = (0.5 - centerX) * 100;
    const ty = (0.5 - centerY) * 100;

    return {
        transform: `translate(${tx}%, ${ty}%) scale(${scale})`,
    };
}
