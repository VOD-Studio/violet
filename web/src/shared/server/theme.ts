import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * getSSRTheme - 从 SSR 请求 cookie 读取已 resolve 的主题值
 *
 * next-themes 用 localStorage 持久化主题，SSR 读不到 → <html> 无 dark class →
 * 首帧亮色 → hydration 后才加 dark → 闪烁。本函数读 cookie（客户端切换主题时
 * 同步写入），让 SSR 输出的 <html> 自带正确 class，hydration 时 class 不变。
 *
 * cookie 存 resolved 值（"light"/"dark"），不存 raw（"system"），保证 SSR
 * 无需 matchMedia 即可确定最终主题。
 *
 * 必须在 server function / loader 内调用（依赖 AsyncLocalStorage 上下文）。
 *
 * @returns "light" | "dark"，无 cookie 默认 light
 */
export const getSSRTheme = createServerFn({ method: "GET" }).handler((): "light" | "dark" => {
	const cookie = getRequestHeader("cookie") ?? "";
	const match = cookie.match(/(?:^|; )theme=([^;]*)/);
	return match?.[1] === "dark" ? "dark" : "light";
});
