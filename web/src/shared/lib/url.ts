/**
 * URL 校验工具。
 *
 * WHATWG URL 解析器（new URL）对 host 合法性校验极宽松，
 * `https://wwww..,.,.` 这类明显非法的域名也能解析成功。
 * validateUrl 在协议校验之外追加 hostname 合法性校验，
 * 仅放行合法域名 / IPv4 / IPv6 / localhost。
 */

/** 校验失败原因，对应调用方的错误文案 */
export type UrlInvalidReason = "empty" | "malformed" | "scheme" | "host";

/** IPv4 四段 0-255 */
const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
/** IPv6（含 :: 缩写），宽松校验，边界由 URL 解析器保证 */
const IPV6_RE = /^\[?[0-9a-fA-F:]+:?[0-9a-fAFX]*\]?$/;
/** 合法域名：每段 1-63 字符的 a-z0-9-（首尾非连字符），TLD 至少 2 位字母 */
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/** 判断 hostname 是否为合法域名 / IP / localhost */
function isValidHost(hostname: string): boolean {
    if (!hostname) return false;
    if (hostname === "localhost") return true;
    // URL 解析时 IPv6 会被方括号包裹，hostname 形如 [::1]
    const bare = hostname.replace(/^\[|\]$/g, "");
    if (bare.includes(":")) return IPV6_RE.test(bare);
    if (/^\d+$/.test(hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        return IPV4_RE.test(hostname);
    }
    return DOMAIN_RE.test(hostname);
}

/**
 * validateUrl - 校验 URL 合法性。
 *
 * @returns 校验通过返回 null，否则返回失败原因（供调用方映射错误文案）。
 *          仅校验 http/https、hostname 为合法域名/IP/localhost，
 *          不保证该 URL 真实可访问（连通性由后端 readability 请求时验证）。
 *
 * @example
 * validateUrl("https://example.com/a")     // null
 * validateUrl("")                          // "empty"
 * validateUrl("不是网址")                   // "malformed"
 * validateUrl("ftp://example.com")         // "scheme"
 * validateUrl("https://wwww..,.,.")        // "host"
 */
export function validateUrl(input: string): UrlInvalidReason | null {
    const trimmed = input.trim();
    if (!trimmed) return "empty";

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        return "malformed";
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "scheme";
    }

    if (!isValidHost(parsed.hostname)) return "host";

    return null;
}

/** 将失败原因映射为中文错误文案，供表单校验直接展示 */
export function urlErrorMessage(reason: UrlInvalidReason | null): string | null {
    switch (reason) {
        case null:
            return null;
        case "empty":
            return "请输入 URL";
        case "malformed":
            return "请输入合法的 URL";
        case "scheme":
            return "仅支持 http/https 链接";
        case "host":
            return "请输入合法的域名或 IP";
    }
}
