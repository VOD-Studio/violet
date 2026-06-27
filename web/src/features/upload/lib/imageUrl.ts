/**
 * 生成带动态处理参数的图片 URL。
 * 配合后端 GET /uploads/{path}?w&h&thumb&format&quality&rotate。
 *
 * @example
 * imageUrl("/uploads/avatar/x.webp", { w: 200, thumb: "200x200", format: "webp" })
 * // => "/uploads/avatar/x.webp?w=200&thumb=200x200&format=webp"
 */
interface ImageOpts {
	w?: number;
	h?: number;
	thumb?: string; // "WxH"
	format?: "jpeg" | "png" | "webp";
	quality?: number;
	rotate?: 0 | 90 | 180 | 270;
}

export function imageUrl(path: string, opts: ImageOpts = {}): string {
	const params = new URLSearchParams();
	if (opts.w) params.set("w", String(opts.w));
	if (opts.h) params.set("h", String(opts.h));
	if (opts.thumb) params.set("thumb", opts.thumb);
	if (opts.format) params.set("format", opts.format);
	if (opts.quality) params.set("quality", String(opts.quality));
	if (opts.rotate) params.set("rotate", String(opts.rotate));
	const qs = params.toString();
	return qs ? `${path}?${qs}` : path;
}

/**
 * 头像专用:200x200 缩略图 + WebP
 * 如果 path 为空或无效，返回默认头像（使用 UI Avatars 生成）
 */
export function avatarUrl(path: string, username?: string): string {
	if (!path || path.trim() === "") {
		// 使用 UI Avatars 生成默认头像
		const name = username ? encodeURIComponent(username) : "User";
		return `https://ui-avatars.com/api/?name=${name}&size=200&background=random`;
	}
	return imageUrl(path, { w: 200, thumb: "200x200", format: "webp" });
}
