/** 代码文本高亮的状态管理；资源与计算分别由共享 highlighter 和增强队列负责。 */
import { type RefObject, useEffect, useState } from "react";
import { highlightCode, highlightCodeAuto, highlightCodeLight } from "./lib/highlighter";

/** 当前代码的增强结果；html 为空时由消费方保留纯文本。 */
export interface UseShikiHighlightResult {
	/** 高亮后的 HTML（shiki 输出 <pre class="shiki">），未完成时为空 */
	html: string;
	/** 是否正在高亮 */
	loading: boolean;
}

/** 高亮主题及可见任务优先级的宿主配置。 */
export interface UseShikiHighlightOptions {
	/**
	 * dark 使用 github-dark，light 使用 github-light，auto 通过 light-dark() 跟随站点配色。
	 *
	 * @default auto
	 */
	theme?: "dark" | "light" | "auto";
	/** 稳定的宿主 ref，仅用于计算优先级，不负责视口门控。 */
	elementRef?: RefObject<HTMLElement | null>;
}

/**
 * 对已经挂载的代码安排高亮，并保留加载与纯文本降级状态。
 *
 * @param code - 原始代码字符串，始终由消费方负责纯文本展示。
 * @param language - 语言标识；不在白名单中时按纯文本生成结果。
 * @param options - 缺省使用自动明暗主题；宿主用于可见任务优先调度。
 * @returns 当前高亮 HTML 与进行状态。
 * @remarks SSR 不启动计算。结果绑定源码、语言和主题；新输入等待期间返回空 HTML，
 * 让消费方立即展示当前纯文本。输入变化或卸载会取消排队任务，旧请求不会覆盖当前结果。
 */
export function useShikiHighlight(
	code: string,
	language: string,
	options?: UseShikiHighlightOptions,
): UseShikiHighlightResult {
	const theme = options?.theme ?? "auto";
	const elementRef = options?.elementRef;
	const [result, setResult] = useState<{
		code: string;
		language: string;
		theme: typeof theme;
		html: string;
	} | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		void (async () => {
			try {
				const scheduleOptions = { element: elementRef?.current, signal: controller.signal };
				const out = await (theme === "light"
					? highlightCodeLight(code, language, scheduleOptions)
					: theme === "auto"
						? highlightCodeAuto(code, language, scheduleOptions)
						: highlightCode(code, language, scheduleOptions));
				if (!controller.signal.aborted) {
					setResult({ code, language, theme, html: out });
				}
			} catch {
				// 仅记录当前请求的失败，让调用方继续显示当前源码。
				if (!controller.signal.aborted) {
					setResult({ code, language, theme, html: "" });
				}
			}
		})();
		return () => {
			controller.abort();
		};
	}, [code, language, theme, elementRef]);

	const current = result?.code === code && result.language === language && result.theme === theme;
	return { html: current ? result.html : "", loading: !current };
}
