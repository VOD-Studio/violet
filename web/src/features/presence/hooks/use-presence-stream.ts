import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { PRESENCE_STREAM_URL } from "../api/client";
import { presenceKeys } from "../api/keys";
import type { PresenceReceipt } from "../lib/presence";
import type { Presence } from "../model/types";

/** 推送连接被拒（限流或已满）后的重试间隔；EventSource 对非 200 响应不会自动重连。 */
const RETRY_AFTER_MS = 30_000;

/**
 * 订阅实时状态推送，写入 Query 缓存供 useLivePresence 读取。
 *
 * @remarks 全站只应挂载一处（顶栏）。标签页隐藏时断开以释放服务端连接，回到前台重连后服务端立即推送当前状态。
 */
export function usePresenceStream(): void {
	const qc = useQueryClient();

	useEffect(() => {
		if (typeof window === "undefined" || typeof EventSource === "undefined") return;
		let source: EventSource | null = null;
		let retry: number | undefined;

		const close = () => {
			window.clearTimeout(retry);
			source?.close();
			source = null;
		};
		const open = () => {
			if (source) return;
			source = new EventSource(PRESENCE_STREAM_URL);
			source.addEventListener("presence", (event) => {
				try {
					const presence = JSON.parse((event as MessageEvent<string>).data) as Presence;
					qc.setQueryData<PresenceReceipt>(presenceKeys.current(), {
						presence,
						receivedAt: Date.now(),
					});
				} catch {
					// 单条坏数据不影响后续推送
				}
			});
			source.onerror = () => {
				if (source?.readyState !== EventSource.CLOSED) return;
				close();
				retry = window.setTimeout(open, RETRY_AFTER_MS);
			};
		};
		const onVisibilityChange = () => (document.hidden ? close() : open());

		if (!document.hidden) open();
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", onVisibilityChange);
			close();
		};
	}, [qc]);
}
