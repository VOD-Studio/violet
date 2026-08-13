/**
 * useNotificationStream - SSE 实时通知 hook
 *
 * 登录用户建立 EventSource 连接到 /notifications/stream：
 * - 新通知推送 → invalidate query（铃铛列表 + 未读数刷新）
 * - 断连 → EventSource 自动重连 + Last-Event-ID 补发（浏览器原生）
 * - 未登录 → 不建连
 */

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { NotificationSSEEvent } from "@shared/api/notifications";
import { useSessionStore } from "@shared/api/session";
import { notificationKeys } from "../api/keys";

export const useNotificationStream = () => {
	const qc = useQueryClient();
	const sessionActive = useSessionStore((s) => s.sessionActive);
	const lastEventIdRef = useRef<string | null>(null);

	useEffect(() => {
		// 仅登录且客户端才建连
		if (!sessionActive || typeof window === "undefined") return;

		const url = "/api/v1/notifications/stream";
		const es = new EventSource(url);

		es.onmessage = (e) => {
			try {
				const event: NotificationSSEEvent = JSON.parse(e.data);
				lastEventIdRef.current = event.id;
				// 新通知到达 → 刷新列表 + 未读数
				qc.invalidateQueries({ queryKey: notificationKeys.list });
				qc.invalidateQueries({ queryKey: notificationKeys.unreadCount });
			} catch {
				// 忽略解析失败（如心跳注释行）
			}
		};

		// EventSource 浏览器原生自动重连；Last-Event-ID 由浏览器自动带上
		es.onerror = () => {
			// EventSource 会在 error 后自动重连，无需手动处理
			// 重连成功后浏览器自动发送 Last-Event-ID header，后端补发漏掉的通知
		};

		return () => {
			es.close();
		};
	}, [sessionActive, qc]);
};
