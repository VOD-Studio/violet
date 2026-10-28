import { getCSRFToken } from "@shared/api/csrf";
import { apiGet, apiPost } from "@shared/api/request";
import type { LinkPreviewLookup, LinkPreviewState } from "../model/types";

interface WaitingLookup {
	url: string;
	resolve: (state: LinkPreviewState) => void;
	reject: (error: unknown) => void;
}

const waiting: WaitingLookup[] = [];
let csrfRequest: Promise<unknown> | undefined;

/** 同一轮挂载的各张卡片合并查询，避免一条推文、一次轮询各发一个 HTTP 请求。 */
export function lookupLinkPreview(url: string): Promise<LinkPreviewState> {
	const { promise, resolve, reject } = Promise.withResolvers<LinkPreviewState>();
	waiting.push({ url, resolve, reject });
	if (waiting.length === 1) queueMicrotask(() => void flush());
	return promise;
}

async function flush() {
	const batch = waiting.splice(0);
	try {
		if (!getCSRFToken()) {
			csrfRequest ??= apiGet("/auth/csrf-token").finally(() => {
				csrfRequest = undefined;
			});
			await csrfRequest;
		}
		const urls = [...new Set(batch.map((item) => item.url))];
		for (let start = 0; start < urls.length; start += 10) {
			const group = urls.slice(start, start + 10);
			const result = await apiPost<LinkPreviewLookup>("/link-cards/lookup", { urls: group });
			for (const item of batch) {
				if (!group.includes(item.url)) continue;
				const card = result.cards[item.url] ?? null;
				const pending = result.pending.includes(item.url);
				if (!card && !pending && !result.unavailable.includes(item.url)) {
					item.reject(new Error("链接预览响应缺少请求状态"));
				} else {
					item.resolve({ url: item.url, card, pending });
				}
			}
		}
	} catch (error) {
		for (const item of batch) item.reject(error);
	}
}
