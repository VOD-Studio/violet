import { useCallback, useEffect, useRef } from "react";
import { setChatTyping } from "../api/client";

/** 客户端重发间隔：持续输入时最多每 3s 上报一次（配合接收端 6s TTL）。 */
const BROADCAST_INTERVAL_MS = 3000;

/**
 * 输入状态广播器：composer 内容变化时节流上报"正在输入"，清空/发送/切换会话时显式上报停止。
 *
 * @param conversationID 当前会话 ID；为空时不发出任何请求
 * @returns notifyTyping/notifyStopped，交给 composer 在内容变化时调用
 */
export function useChatTypingBroadcaster(conversationID: string | null) {
	const lastSentAtRef = useRef(0);
	const typingRef = useRef(false);

	useEffect(() => {
		// 切换会话时重置状态；卸载/切换前若仍处于"正在输入"，为上一个会话补发停止信号。
		typingRef.current = false;
		lastSentAtRef.current = 0;
		return () => {
			if (conversationID && typingRef.current) {
				void setChatTyping(conversationID, false).catch(() => {});
			}
		};
	}, [conversationID]);

	const notifyTyping = useCallback(() => {
		if (!conversationID) return;
		typingRef.current = true;
		const now = Date.now();
		if (now - lastSentAtRef.current < BROADCAST_INTERVAL_MS) return;
		lastSentAtRef.current = now;
		void setChatTyping(conversationID, true).catch(() => {});
	}, [conversationID]);

	const notifyStopped = useCallback(() => {
		if (!conversationID || !typingRef.current) return;
		typingRef.current = false;
		lastSentAtRef.current = 0;
		void setChatTyping(conversationID, false).catch(() => {});
	}, [conversationID]);

	return { notifyTyping, notifyStopped };
}
