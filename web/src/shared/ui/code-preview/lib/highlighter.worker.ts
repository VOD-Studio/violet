import { type HighlightTheme, highlightSource } from "./highlighter-engine";

/** 单个代码块的线程请求；只传可序列化输入，不传页面节点或取消信号。 */
export interface HighlightRequest {
	/** 关联并发请求与回复，不表示文章或代码块身份。 */
	id: number;
	code: string;
	language: string;
	theme: HighlightTheme;
}

/** 只交付完整 HTML 或明确失败；错误文本不会作为 HTML 插入页面。 */
export type HighlightResponse = { id: number } & ({ html: string } | { error: string });

self.addEventListener("message", async ({ data }: MessageEvent<HighlightRequest>) => {
	let response: HighlightResponse;
	try {
		response = {
			id: data.id,
			html: await highlightSource(data.code, data.language, data.theme),
		};
	} catch (error) {
		response = {
			id: data.id,
			error: error instanceof Error ? error.message : String(error),
		};
	}
	self.postMessage(response);
});
