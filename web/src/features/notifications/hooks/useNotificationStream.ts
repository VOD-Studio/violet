/**
 * useNotificationStream - SSE 实时通知 hook
 *
 * 登录用户建立 EventSource 连接到 /notifications/stream：
 * - 新通知推送 → invalidate query（铃铛列表 + 未读数刷新）
 * - 断连 → EventSource 自动重连 + Last-Event-ID 补发（浏览器原生）
 * - 未登录 → 不建连
 */

import type { NotificationSSEEvent } from "@shared/api/notifications";
import { useSessionStore } from "@shared/api/session";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
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

		// 建连即对账：后端推送是 fire-and-forget（无连接时直接丢弃），
		// 通知可能落在「铃铛挂载后的初次查询」与「本次建连」之间的空窗，补拉一次消除盲区
		es.onopen = () => {
			qc.invalidateQueries({ queryKey: notificationKeys.list });
			qc.invalidateQueries({ queryKey: notificationKeys.unreadCount });
		};

		es.onmessage = (e) => {
			try {
				const event: NotificationSSEEvent = JSON.parse(e.data);
				lastEventIdRef.current = event.id;
				// 新通知到达 → 刷新列表 + 未读数
				qc.invalidateQueries({ queryKey: notificationKeys.list });
				qc.invalidateQueries({ queryKey: notificationKeys.unreadCount });
				// badge +1 太隐蔽，「完成后会通知你」的承诺靠 toast 兑现；
				// 只弹 1 分钟内的新通知——重连补发（Last-Event-ID）的是旧通知，不再弹
				if (Date.now() - new Date(event.created_at).getTime() < 60_000) {
					toast(event.title, { description: event.body || undefined });
				}
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
