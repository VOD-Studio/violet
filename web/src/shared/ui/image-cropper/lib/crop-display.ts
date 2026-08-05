import type { CropRect } from "../types";

/** 像素尺寸 */
export interface Size {
	w: number;
	h: number;
}

/** img 的显式几何:尺寸 + 相对容器的绝对定位偏移(px) */
export interface CropTransform {
	width: number;
	height: number;
	left: number;
	top: number;
}

/**
 * coverCropTransform - 计算「选区精确复现」的 img 几何。
 *
 * 把选区当作图片本身 object-fit:cover 进容器:统一缩放使选区铺满容器,
 * 选区中心对齐容器中心——
 * - 选区宽高比 == 容器宽高比:选区四边精确贴合容器(精确复现选区)
 * - 不一致:选区铺满容器,溢出维度居中裁切(选区中心保持可见)
 *
 * 调用方用返回的 width/height/left/top 显式设置 img 几何,不叠加
 * object-fit/transform scale,避免历史的「双重放大」问题。
 *
 * 任一输入尺寸非正时返回 null(调用方应等测量就绪后再渲染)。
 */
export function coverCropTransform(rect: CropRect, img: Size, box: Size): CropTransform | null {
	if (rect.w <= 0 || rect.h <= 0 || img.w <= 0 || img.h <= 0 || box.w <= 0 || box.h <= 0) {
		return null;
	}
	// 选区像素尺寸
	const rw = rect.w * img.w;
	const rh = rect.h * img.h;
	// cover:统一缩放,选区两维都不小于容器
	const scale = Math.max(box.w / rw, box.h / rh);
	const width = img.w * scale;
	const height = img.h * scale;
	// 选区中心对齐容器中心:选区左/上缘落在 (box - rect*scale)/2 处
	return {
		width,
		height,
		left: (box.w - rw * scale) / 2 - rect.x * width,
		top: (box.h - rh * scale) / 2 - rect.y * height,
	};
}
