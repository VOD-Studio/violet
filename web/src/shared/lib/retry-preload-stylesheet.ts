import { createAsyncLoader } from "./create-async-loader";

const CSS_PRELOAD_ERROR = "Unable to preload CSS for ";
const stylesheetRetries = new Map<string, () => Promise<void>>();

/**
 * 在重试动态模块前恢复其失败的 Vite 样式依赖。
 *
 * @param error - 上次模块加载的原始异常；非样式预加载错误不额外请求资源。
 * @returns 样式成功加载后完成；再次失败则拒绝，保留调用方的局部错误态。
 * @remarks Vite 会记住失败的预加载 URL，重调 import 不会重发 CSS 请求。
 * 只恢复异常中指明且已存在的样式链接，保留 CSP 等属性；并发与后续调用复用成功的恢复结果。
 */
export function retryPreloadStylesheet(error: unknown): Promise<void> {
	if (!(error instanceof Error) || !error.message.startsWith(CSS_PRELOAD_ERROR)) {
		return Promise.resolve();
	}
	const href = new URL(error.message.slice(CSS_PRELOAD_ERROR.length), document.baseURI).href;
	let retry = stylesheetRetries.get(href);
	if (!retry) {
		retry = createAsyncLoader(() => {
			const previous = Array.from(
				document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
			).find((link) => link.href === href);
			if (!previous) return Promise.reject(error);
			// 失败的 link 也可能带空 CSSStyleSheet，只以 load 事件确认恢复。
			const replacement = document.createElement("link");
			for (const attribute of previous.attributes) {
				replacement.setAttribute(attribute.name, attribute.value);
			}
			replacement.nonce = previous.nonce;
			return new Promise<void>((resolve, reject) => {
				replacement.addEventListener(
					"load",
					() => {
						previous.remove();
						resolve();
					},
					{ once: true },
				);
				replacement.addEventListener(
					"error",
					() => {
						replacement.remove();
						reject(error);
					},
					{ once: true },
				);
				document.head.appendChild(replacement);
			});
		});
		stylesheetRetries.set(href, retry);
	}
	return retry();
}
