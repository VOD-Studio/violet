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
interface ImageOpts {
    w?: number;
    h?: number;
    thumb?: string; // "WxH"
    format?: "jpeg" | "png" | "webp";
    quality?: number;
    rotate?: 0 | 90 | 180 | 270;
}

/** 后端动态处理参数全集(originalImageUrl 剥离用)。 */
const PROCESSING_PARAMS = ["w", "h", "thumb", "format", "quality", "rotate"] as const;

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
 * 内容图缩略约定:展示层(正文/评论/封面/编辑器等)统一走 w 档缩略 + webp,
 * 只有预览查看详情才加载原图。
 *
 * GIF 特判:剥除所有后端处理参数(format=webp 会让后端解码 GIF 只取第一帧,
 * 动画静默丢失),直接返回原 path(含已有的 ?crop=)——与 avatarUrl 同一约定。
 */
export function contentImageUrl(path: string, opts: { width: number }): string {
    if (!path) return path;
    if (isGifPath(path)) {
        return path;
    }
    return imageUrl(path, { w: opts.width, format: "webp" });
}

/**
 * 剥离后端动态处理参数(w/h/thumb/format/quality/rotate),还原原图 URL。
 * 保留 crop 等纯前端参数。预览层从已缩略的 DOM src 还原原图用
 * (内容图显示 w 档缩略,点开预览必须加载原图)。
 */
export function originalImageUrl(path: string): string {
    const i = path.indexOf("?");
    if (i < 0) return path;
    const base = path.slice(0, i);
    const params = new URLSearchParams(path.slice(i + 1));
    for (const k of PROCESSING_PARAMS) {
        params.delete(k);
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
}

/**
 * 头像专用:200x200 缩略图 + WebP
 * 如果 path 为空或无效，返回默认头像（使用 UI Avatars 生成）
 *
 * GIF 特判:剥除所有后端处理参数(format=webp 会让后端解码 GIF 只取第一帧,
 * 动画静默丢失),直接返回原 path(含已有的 ?crop=)。GIF 动画保留的必要条件
 * 是「不走任何后端图片处理参数,只用 ?crop + CSS 视觉裁剪」(见 CroppedImage)。
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
