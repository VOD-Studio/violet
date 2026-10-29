/**
 * 拼出客户端要填的完整上报地址：https 站点用 wss://，本地 http 开发用 ws://。
 *
 * @param path - 服务端返回的上报路由
 */
export function ingestUrl(path: string, location: Pick<Location, "protocol" | "host">): string {
	const scheme = location.protocol === "https:" ? "wss:" : "ws:";
	return `${scheme}//${location.host}${path}`;
}

/** 与服务端 IngestPath 一致；签发前展示地址时使用。 */
export const INGEST_PATH = "/api/v1/presence/ingest";
