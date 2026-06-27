/**
 * 浏览器 cookie 读取工具
 *
 * 仅用于读取非 HttpOnly cookie（如 mimo_csrf），
 * HttpOnly cookie（如 mimo_access/mimo_refresh）JS 无法读取，
 * 由浏览器自动随请求携带。
 */

/**
 * getCookie - 读取指定 cookie 值
 *
 * @param name cookie 名
 * @returns cookie 值（已 URL 解码），不存在或 SSR 时返回空串
 *
 * @example
 * getCookie("mimo_csrf") // "abc123..."
 */
export const getCookie = (name: string): string => {
    if (typeof document === "undefined") return "";
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : "";
};
