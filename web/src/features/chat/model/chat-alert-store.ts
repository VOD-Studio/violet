import { create } from "zustand";

/** 聊天事件流里到达的一条别人发来的新消息；是否弹轻提示由接线层结合当前页面决定。 */
export interface IncomingChatMessage {
	conversationID: string;
	messageID: string;
	senderID: string;
}

interface ChatAlertState {
	/** 最近一条；更新的消息直接顶替，轻提示一次只显示一条。 */
	incoming: IncomingChatMessage | null;
	raise: (message: IncomingChatMessage) => void;
	clear: () => void;
}

export const useChatAlertStore = create<ChatAlertState>((set) => ({
	incoming: null,
	raise: (message) => set({ incoming: message }),
	clear: () => set({ incoming: null }),
}));
