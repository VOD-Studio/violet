const tweetHosts: Record<string, true | undefined> = {
	"x.com": true,
	"www.x.com": true,
	"mobile.x.com": true,
	"twitter.com": true,
	"www.twitter.com": true,
	"mobile.twitter.com": true,
};

export function safeUrl(value: unknown): string | undefined {
	if (typeof value !== "string" || /[\p{Cc}\s\\]/u.test(value)) return;
	if (value.startsWith("/") && !value.startsWith("//")) return value;
	try {
		const url = new URL(value);
		if (
			(url.protocol === "https:" || url.protocol === "http:") &&
			!url.username &&
			!url.password
		) {
			return url.href;
		}
	} catch {
		return;
	}
}

/**
 * 解析正十进制推文标识或规范 X/Twitter 原文地址。
 * @param value - 原始标识或绝对地址；不接受其他主机、凭证或危险协议。
 * @returns 有效标识；无法解析时返回 null。
 */
export function parseTweetId(value: string): string | null {
	if (/^[1-9]\d{0,19}$/.test(value)) return value;
	const safe = safeUrl(value);
	if (!safe || safe.startsWith("/")) return null;
	const url = new URL(safe);
	if (tweetHosts[url.hostname] !== true || url.port) return null;
	return (
		/^\/(?:[A-Za-z0-9_]{1,15}|i\/web)\/status\/([1-9]\d{0,19})(?:\/(?:photo|video)\/\d+)?\/?$/.exec(
			url.pathname,
		)?.[1] ?? null
	);
}

export function canonicalUrl(id: string): string {
	return `https://x.com/i/web/status/${id}`;
}

export function tweetUrl(url: string, id?: string): string | undefined {
	return safeUrl(url) ?? (id && /^[1-9]\d{0,19}$/.test(id) ? canonicalUrl(id) : undefined);
}
