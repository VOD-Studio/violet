import type { HighlightRequest, HighlightResponse } from "./highlight-types";
import { highlightSource } from "./highlighter-engine";

self.addEventListener("message", async ({ data }: MessageEvent<HighlightRequest>) => {
	let response: HighlightResponse;
	try {
		response = { id: data.id, lines: await highlightSource(data.code, data.language) };
	} catch (error) {
		response = { id: data.id, error: error instanceof Error ? error.message : String(error) };
	}
	self.postMessage(response);
});
