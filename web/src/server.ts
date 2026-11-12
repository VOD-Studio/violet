import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";
import { createAnonymousHtmlCache } from "./shared/server/anonymous-html-cache";

// 最多存 16 MiB 完整页面；发布/编辑后最迟 20 秒重取，短时故障允许旧页兜底 2 分钟。
const serve = createAnonymousHtmlCache({
	cacheable: (path) => /^\/blog\/[^/]+\/?$/.test(path),
	ttlMs: 20_000,
	staleIfErrorMs: 120_000,
	maxBytes: 16 * 1024 * 1024,
});
const render = createStartHandler(defaultStreamHandler);

export default createServerEntry({
	fetch: (...args) => serve(args[0], () => render(...args)),
});
