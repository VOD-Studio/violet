import { type EnhancementOptions, scheduleEnhancement } from "@shared/lib/schedule-enhancement";
import type { HighlightRequest, HighlightResponse } from "./highlighter.worker";
import type { HighlightTheme } from "./highlighter-engine";

interface PendingHighlight {
	resolve: (html: string) => void;
	reject: (error: unknown) => void;
	cleanup: () => void;
}

const pending = new Map<number, PendingHighlight>();
let worker: Worker | undefined;
let nextRequestId = 0;

function settle(id: number, result: { html: string } | { error: unknown }) {
	const request = pending.get(id);
	if (!request) return;
	pending.delete(id);
	request.cleanup();
	if ("html" in result) request.resolve(result.html);
	else request.reject(result.error);
}

function getWorker(): Worker {
	if (worker) return worker;
	const current = new Worker(new URL("./highlighter.worker.ts", import.meta.url), {
		type: "module",
		name: "violet-code-highlight",
	});
	worker = current;
	const fail = (error: Error) => {
		if (worker !== current) return;
		worker = undefined;
		current.terminate();
		for (const id of pending.keys()) settle(id, { error });
	};
	current.addEventListener("message", ({ data }: MessageEvent<HighlightResponse>) => {
		settle(data.id, "html" in data ? data : { error: new Error(data.error) });
	});
	current.addEventListener("error", (event) => {
		fail(new Error(event.message ? event.message : "代码高亮线程加载失败"));
	});
	current.addEventListener("messageerror", () => fail(new Error("无法读取代码高亮结果")));
	return current;
}

function requestHighlight(
	code: string,
	language: string,
	theme: HighlightTheme,
	signal?: AbortSignal,
): Promise<string> {
	signal?.throwIfAborted();
	const current = getWorker();
	const id = nextRequestId++;
	const result = Promise.withResolvers<string>();
	const abort = () => settle(id, { error: signal?.reason });
	pending.set(id, {
		resolve: result.resolve,
		reject: result.reject,
		cleanup: () => signal?.removeEventListener("abort", abort),
	});
	signal?.addEventListener("abort", abort, { once: true });
	try {
		current.postMessage({ id, code, language, theme } satisfies HighlightRequest);
	} catch (error) {
		settle(id, { error });
	}
	return result.promise;
}

async function highlight(
	code: string,
	language: string,
	theme: HighlightTheme,
	options?: EnhancementOptions,
): Promise<string> {
	// 共享队列只安排线程投递，不能等待线程的下载或计算，否则会阻塞其他可见增强。
	const { result } = await scheduleEnhancement(
		() => ({ result: requestHighlight(code, language, theme, options?.signal) }),
		options,
	);
	return result;
}

/**
 * 在按需启动的共享 Worker 中生成固定深色主题的高亮 HTML。
 *
 * @param lang - 支持白名单及别名；未知语言按纯文本处理。
 * @param options - 投递前优先处理可见宿主；取消立即拒绝等待，不终止其他代码块。
 * @returns 完整 HTML；线程或计算失败时拒绝，由消费方保留源码。
 * @remarks SSR 不调用此函数。已投递的计算不会被强行中断，取消后的回复会被丢弃。
 * 线程故障不会自动重试；后续调用可重新建立线程。
 */
export function highlightCode(
	code: string,
	lang: string,
	options?: EnhancementOptions,
): Promise<string> {
	return highlight(code, lang, "dark", options);
}

/**
 * 在共享 Worker 中生成固定浅色主题的高亮 HTML。
 *
 * @param lang - 语言解析与降级策略同 {@link highlightCode}。
 * @param options - 可见宿主优先级与取消信号。
 * @returns 完整 HTML；失败时保留当前源码，不复用其他请求的结果。
 */
export function highlightCodeLight(
	code: string,
	lang: string,
	options?: EnhancementOptions,
): Promise<string> {
	return highlight(code, lang, "light", options);
}

/**
 * 在共享 Worker 中生成随 color-scheme 切换的双主题高亮 HTML。
 *
 * @param lang - 语言解析与降级策略同 {@link highlightCode}。
 * @param options - 可见宿主优先级与取消信号。
 * @returns 同时包含明暗配色的完整 HTML；切换主题不需要重新计算。
 */
export function highlightCodeAuto(
	code: string,
	lang: string,
	options?: EnhancementOptions,
): Promise<string> {
	return highlight(code, lang, "auto", options);
}
