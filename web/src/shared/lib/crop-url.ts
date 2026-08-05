import type { CropRect } from "@shared/ui/image-cropper/types";

/**
 * 裁剪坐标的 URL 编码工具。
 *
 * GIF 选区不重编码文件,改为把归一化坐标(相对原图 0~1)编码进 URL 查询参数
 * `?crop=x,y,w,h`,显示层用 object-position 聚焦选区(见 CroppedImage)。
 *
 * 与 imageUrl.ts 的动态处理参数(w/thumb/format 等)正交:后端 transformer
 * 只读已知参数,会忽略 crop,因此本参数纯前端约定。
 */

function round(n: number): number {
	return Math.round(n * 10000) / 10000;
}

function isValidRect(rect: CropRect): boolean {
	return (
		rect.x >= 0 &&
		rect.x <= 1 &&
		rect.y >= 0 &&
		rect.y <= 1 &&
		rect.w > 0 &&
		rect.w <= 1 &&
		rect.h > 0 &&
		rect.h <= 1 &&
		rect.x + rect.w <= 1.0001 &&
		rect.y + rect.h <= 1.0001
	);
}

/**
 * 给 URL 附加(或覆盖)`?crop=x,y,w,h` 参数。
 * 保留其他查询参数,幂等。逗号不编码(URL 安全,浏览器/后端都能正确处理)。
 */
export function withCrop(path: string, rect: CropRect): string {
	const [base, search = ""] = path.split("?");
	const cropValue = `${round(rect.x)},${round(rect.y)},${round(rect.w)},${round(rect.h)}`;
	// 保留除 crop 外的已有参数(避免 URLSearchParams 对逗号编码)
	const params = new URLSearchParams(search);
	params.delete("crop");
	const kept = params.toString();
	const query = kept ? `${kept}&crop=${cropValue}` : `crop=${cropValue}`;
	return `${base}?${query}`;
}

/**
 * 从 URL 解析 crop 参数。无或非法时返回 null。
 */
export function parseCrop(url: string): CropRect | null {
	const i = url.indexOf("?");
	if (i < 0) return null;
	const params = new URLSearchParams(url.slice(i + 1));
	const raw = params.get("crop");
	if (!raw) return null;
	const parts = raw.split(",").map(Number);
	if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
	const rect: CropRect = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
	return isValidRect(rect) ? rect : null;
}

// re-export CropRect 供调用方就近导入
export type { CropRect } from "@shared/ui/image-cropper/types";
