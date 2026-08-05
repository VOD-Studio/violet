/**
 * canvas 图片裁剪重编码工具。
 *
 * 把图片 src 按归一化选区(相对原图 0~1)裁剪,canvas drawImage 选区后
 * 重编码为 WebP Blob。仅静态图(jpeg/png/webp)使用——GIF 重编码会丢动画,
 * 走坐标 + CSS 视觉裁剪路径(见 Issue-0017)。
 */

// CropRect 类型定义在 shared 层(image-cropper/types),此处 re-export
// 保持调用方就近导入,依赖方向 features → shared 合法。
export type { CropRect } from "@shared/ui/image-cropper/types";

import type { CropRect } from "@shared/ui/image-cropper/types";

/**
 * 把图片 src 按归一化选区裁剪,canvas 重编码为 WebP Blob。
 *
 * @param src 图片源(object URL 或远程 URL)
 * @param rect 归一化选区(0~1)
 * @param quality WebP 质量 0~1,默认 0.9
 */
export async function cropImageToBlob(src: string, rect: CropRect, quality = 0.9): Promise<Blob> {
	const img = await loadImage(src);
	const sx = rect.x * img.naturalWidth;
	const sy = rect.y * img.naturalHeight;
	const sw = rect.w * img.naturalWidth;
	const sh = rect.h * img.naturalHeight;

	const canvas = document.createElement("canvas");
	canvas.width = Math.round(sw);
	canvas.height = Math.round(sh);
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("无法创建 canvas 2D 上下文");

	ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error("canvas.toBlob 返回 null"));
			},
			"image/webp",
			quality,
		);
	});
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous"; // 避免 canvas 污染(tainted)
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`图片加载失败: ${src}`));
		img.src = src;
	});
}
