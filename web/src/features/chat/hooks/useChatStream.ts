import { useSessionStore } from "@shared/api/session";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { chatEventStreamURL } from "../api/client";
import { chatKeys } from "../api/keys";
import type { ChatEvent } from "../model/types";

/** 建立聊天 SSE 事件流，断线由浏览器自动重连并携带 Last-Event-ID。 */
export const useChatStream = () => {
	const queryClient = useQueryClient();
	const sessionActive = useSessionStore((state) => state.sessionActive);

	useEffect(() => {
		if (!sessionActive || typeof window === "undefined") return;
		const stream = new EventSource(chatEventStreamURL);
		stream.onopen = () => {
			queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
			queryClient.invalidateQueries({ queryKey: chatKeys.unreadCount() });
		};
		stream.addEventListener("chat", (event) => {
			try {
				const payload = JSON.parse((event as MessageEvent).data) as ChatEvent;
				const conversationID = payload.data.conversation_id;
				queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
				queryClient.invalidateQueries({ queryKey: chatKeys.unreadCount() });
				if (typeof conversationID === "string") {
					queryClient.invalidateQueries({
						queryKey: chatKeys.conversation(conversationID),
					});
					queryClient.invalidateQueries({ queryKey: chatKeys.messages(conversationID) });
					if (payload.type === "member.changed") {
						queryClient.invalidateQueries({
							queryKey: chatKeys.members(conversationID),
						});
					}
				}
				if (payload.type === "room.invited") {
					toast.info("新的聊天邀请", { description: "打开聊天工作区查看房间" });
				}
			} catch {
				// 畸形事件交给下一次对账请求恢复。
			}
		});
		return () => stream.close();
	}, [queryClient, sessionActive]);
};
