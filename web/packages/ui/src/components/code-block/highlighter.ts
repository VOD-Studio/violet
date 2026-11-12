import type { HighlightRequest, HighlightResponse, HighlightToken } from "./highlight-types";

interface PendingHighlight {
	resolve: (lines: HighlightToken[][]) => void;
	reject: (error: unknown) => void;
	cleanup: () => void;
}
const pending = new Map<number, PendingHighlight>();
let worker: Worker | undefined;
let nextId = 0;

function settle(id: number, response: { lines: HighlightToken[][] } | { error: unknown }) {
	const request = pending.get(id);
	if (!request) return;
	pending.delete(id);
	request.cleanup();
	if ("lines" in response) request.resolve(response.lines);
	else request.reject(response.error);
}

function getWorker() {
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
		settle(data.id, "lines" in data ? data : { error: new Error(data.error) });
	});
	current.addEventListener("error", (event) =>
		fail(new Error(event.message || "代码高亮线程加载失败")),
	);
	current.addEventListener("messageerror", () => fail(new Error("无法读取代码高亮结果")));
	return current;
}

/** 共享线程仅交付当前请求的 token；取消不会终止其他代码块的计算。 */
export function highlightCode(
	code: string,
	language: string,
	signal: AbortSignal,
): Promise<HighlightToken[][]> {
	signal.throwIfAborted();
	const current = getWorker();
	const id = nextId++;
	return new Promise((resolve, reject) => {
		const abort = () => settle(id, { error: signal.reason });
		pending.set(id, {
			resolve,
			reject,
			cleanup: () => signal.removeEventListener("abort", abort),
		});
		signal.addEventListener("abort", abort, { once: true });
		try {
			current.postMessage({ id, code, language } satisfies HighlightRequest);
		} catch (error) {
			settle(id, { error });
		}
	});
}
