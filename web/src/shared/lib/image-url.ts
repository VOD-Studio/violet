import { SITE_URL } from "@shared/config/env";

// 与 /uploads 动态处理接口的宽度上限保持一致；极小 crop 不应生成 400 请求。
const MAX_IMAGE_WIDTH = 4096;

interface ImageOpts {
	w?: number;
	h?: number;
	thumb?: string; // "WxH"
	format?: "jpeg" | "png" | "webp";
	/** 1–100；WebP 显式质量采用请求级有损编码，不改变上传策略。 */
	quality?: number;
	rotate?: 0 | 90 | 180 | 270;
}

/** 后端动态处理参数全集(originalImageUrl 剥离用)。 */
const PROCESSING_PARAMS = ["w", "h", "thumb", "format", "quality", "rotate"] as const;

/**
 * 生成带动态处理参数的图片 URL。
 * 配合后端 GET /uploads/{path}?w&h&thumb&format&quality&rotate。
 *
 * path 已带查询参数(如 ?crop=)时合并而非追加第二个问号;
 * 同名参数覆盖,重复调用幂等。
 *
 * @example
 * imageUrl("/uploads/avatar/x.webp", { w: 200, thumb: "200x200", format: "webp" })
 * // => "/uploads/avatar/x.webp?w=200&thumb=200x200&format=webp"
 * imageUrl("/uploads/a.jpg?crop=0.1,0.2,0.5,0.5", { w: 800 })
 * // => "/uploads/a.jpg?crop=0.1%2C0.2%2C0.5%2C0.5&w=800"(crop 经 URLSearchParams 往返不丢失)
 */
export function imageUrl(path: string, opts: ImageOpts = {}): string {
	const [base, search = ""] = path.split("?");
	const params = new URLSearchParams(search);
	if (opts.w) params.set("w", String(opts.w));
	if (opts.h) params.set("h", String(opts.h));
	if (opts.thumb) params.set("thumb", opts.thumb);
	if (opts.format) params.set("format", opts.format);
	if (opts.quality) params.set("quality", String(opts.quality));
	if (opts.rotate) params.set("rotate", String(opts.rotate));
	const qs = params.toString();
	return qs ? `${base}?${qs}` : base;
}

/**
 * 为本站上传图生成保留完整画面的 WebP 展示派生图（quality=80）。
 *
 * @remarks GIF 直接使用原图；动画 WebP 由服务端检测并原样返回。
 * 外链不附加本站处理参数。原图预览与下载使用 {@link originalImageUrl}。
 * @param opts - 目标像素宽度，按调用方展示宽度与 DPR 选择；最大为接口上限 4096。
 */
export function contentImageUrl(path: string, opts: { width: number }): string {
	if (!isUploadedImage(path)) return path;
	if (isGifPath(path)) return originalImageUrl(path);
	const [base, search = ""] = path.split("?");
	const params = new URLSearchParams(search);
	// 展示层只缩放全图；作者 crop 由 CSS 复现，不能再次居中裁切。
	params.delete("thumb");
	params.delete("h");
	const query = params.toString();
	return imageUrl(query ? `${base}?${query}` : base, {
		w: Math.min(MAX_IMAGE_WIDTH, opts.width),
		format: "webp",
		quality: 80,
	});
}

/**
 * 为未知素材尺寸生成按视口与 DPR 选择的 picture 候选。
 *
 * @remarks 每个 source 只有一个 URL，不声明未经素材元数据证实的像素宽度或密度。
 * 后端只缩不放大或原样返回动画时，浏览器仍使用资源本身的自然尺寸。
 * @param widths - 从小到大的请求宽度档位。
 * @param maxDisplayWidth - 展示列宽上界；省略时按整个视口估计。
 * @returns GIF 与外链返回空数组；其余结果可直接展开到 picture 的 source。
 */
export function contentImageSources(
	path: string,
	widths: readonly number[],
	maxDisplayWidth = Number.POSITIVE_INFINITY,
): { media: string; srcSet: string }[] {
	if (!isUploadedImage(path) || widths.length === 0 || isGifPath(path)) return [];
	const candidates = [
		...new Set([...widths.map((width) => Math.min(MAX_IMAGE_WIDTH, width)), MAX_IMAGE_WIDTH]),
	].sort((a, b) => a - b);
	const conditions = new Map<number, string[]>();
	for (const density of [1, 1.5, 2, 3, 4]) {
		for (const width of candidates) {
			const coversColumn = width >= maxDisplayWidth * density;
			const media = `(max-resolution: ${density}dppx)${coversColumn ? "" : ` and (max-width: ${width / density}px)`}`;
			const matches = conditions.get(width) ?? [];
			matches.push(media);
			conditions.set(width, matches);
			if (coversColumn) break;
		}
	}
	return candidates
		.filter((width) => width === MAX_IMAGE_WIDTH || conditions.has(width))
		.map((width) => ({
			media: width === MAX_IMAGE_WIDTH ? "" : (conditions.get(width) ?? []).join(", "),
			srcSet: contentImageUrl(path, { width }),
		}));
}

/**
 * 剥离本站动态处理参数，恢复灯箱与下载使用的原图 URL。
 *
 * @remarks 保留作者 crop；外站查询参数属于其资源契约，不作修改。
 */
export function originalImageUrl(path: string): string {
	if (!isUploadedImage(path)) return path;
	const i = path.indexOf("?");
	if (i < 0) return path;
	const base = path.slice(0, i);
	const params = new URLSearchParams(path.slice(i + 1));
	if (!PROCESSING_PARAMS.some((key) => params.has(key))) return path;
	for (const k of PROCESSING_PARAMS) {
		params.delete(k);
	}
	const qs = params.toString();
	return qs ? `${base}?${qs}` : base;
}

/**
 * 生成头像缩略地址，缺少头像时使用默认头像服务。
 *
 * @remarks GIF 保留原地址；其他格式沿用头像专用裁剪，不套用正文展示质量策略。
 */
export function avatarUrl(path: string, username?: string): string {
	if (!path || path.trim() === "") {
		// 使用 UI Avatars 生成默认头像
		const name = username ? encodeURIComponent(username) : "User";
		return `https://ui-avatars.com/api/?name=${name}&size=200&background=random`;
	}
	if (isGifPath(path)) {
		return path;
	}
	return imageUrl(path, { w: 200, thumb: "200x200", format: "webp" });
}

/** 判断 path(剥离查询参数后)是否 .gif 后缀(大小写不敏感) */
function isGifPath(path: string): boolean {
	return path.split("?")[0].toLowerCase().endsWith(".gif");
}

function isUploadedImage(path: string): boolean {
	if (!path) return false;
	if (path.startsWith("/uploads/")) return true;
	try {
		const url = new URL(path);
		return url.origin === new URL(SITE_URL).origin && url.pathname.startsWith("/uploads/");
	} catch {
		return false;
	}
}

/**
 * 为本站内容图生成响应式宽度候选；GIF 与外链不生成派生候选。
 *
 * @param widths - 完整源图的目标像素宽度，超过接口上限的值钳制后去重。
 * @returns 可直接赋给 img.srcSet 的宽度描述符；不支持派生时返回 undefined。
 */
export function contentImageSrcSet(path: string, widths: readonly number[]): string | undefined {
	if (!isUploadedImage(path) || widths.length === 0 || isGifPath(path)) return undefined;
	const candidates = [...new Set(widths.map((width) => Math.min(MAX_IMAGE_WIDTH, width)))];
	return candidates.map((width) => `${contentImageUrl(path, { width })} ${width}w`).join(", ");
}
