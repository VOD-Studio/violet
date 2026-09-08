import { contentImageUrl } from "@shared/lib/image-url";

const ABSOLUTE_HTTP_URL = /^https?:\/\//iu;
const SAFE_LOCAL_PATH = /^\/(?!\/)/u;
const SAFE_EMAIL_URL = /^mailto:[^\s@]+@[^\s@]+$/iu;

/** 仅放行阅读卡片可安全导航的协议与站内绝对路径。 */
export function isSafeArticleHref(value: string, allowEmail = false): boolean {
	const href = value.trim();
	if (SAFE_LOCAL_PATH.test(href)) return true;
	if (allowEmail && SAFE_EMAIL_URL.test(href)) return true;
	if (!ABSOLUTE_HTTP_URL.test(href)) return false;
	try {
		const parsed = new URL(href);
		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

/** 图片只允许 http(s) 或站内绝对路径，拒绝 data/javascript 等可执行载体。 */
export function isSafeArticleImage(value: string): boolean {
	return isSafeArticleHref(value, false);
}

/** 站内上传图使用响应式处理，远程图保持原 URL，避免给第三方拼接私有参数。 */
export function articleEmbedImageUrl(value: string, width: number): string {
	return value.startsWith("/uploads/") ? contentImageUrl(value, { width }) : value;
}

/** 卡片右上角展示稳定、去掉 www. 的来源域名。 */
export function articleLinkHostname(value: string): string {
	try {
		return new URL(value, "https://violet.invalid").hostname.replace(/^www\./iu, "");
	} catch {
		return "";
	}
}
