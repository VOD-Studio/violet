import { create } from "zustand";

/** 接收端 TTL 兜底：客户端重发间隔 3s 的 2 倍安全边际，容忍一次丢包不闪烁。 */
const TYPING_TTL_MS = 6000;

/** conversationID + userID 复合键，定位单个用户在单个会话内的过期计时器。 */
function timerKey(conversationID: string, userID: string) {
	return `${conversationID}:${userID}`;
}

const timers = new Map<string, number>();

/**
 * ChatTypingState - 会话输入状态的瞬态展示层，与聊天域事件持久化管线无关
 *
 * 后端不持久化 typing.updated 事件（见 CONTEXT.md「输入状态」词条），前端
 * 因此也不经 TanStack Query 缓存，而是本 store 直接承载 + TTL 自动过期，
 * 由 useChatStream 收到 SSE 事件时写入（见 hooks/useChatStream.ts）。
 */
export interface ChatTypingState {
	/** conversationID -> 正在输入的 userID 集合 */
	typing: Record<string, Record<string, true>>;
	/** 标记用户正在输入，并（重新）启动该用户的 TTL 过期计时器 */
	setTyping: (conversationID: string, userID: string) => void;
	/** 显式清除用户的输入状态（发送消息/清空输入框/失焦/TTL 到期时调用） */
	clearTyping: (conversationID: string, userID: string) => void;
}

export const useChatTypingStore = create<ChatTypingState>((set, get) => ({
	typing: {},
	setTyping: (conversationID, userID) => {
		const key = timerKey(conversationID, userID);
		const existing = timers.get(key);
		if (existing !== undefined) window.clearTimeout(existing);
		timers.set(
			key,
			window.setTimeout(() => get().clearTyping(conversationID, userID), TYPING_TTL_MS),
		);
		set((state) => ({
			typing: {
				...state.typing,
				[conversationID]: { ...state.typing[conversationID], [userID]: true },
			},
		}));
	},
	clearTyping: (conversationID, userID) => {
		const key = timerKey(conversationID, userID);
		const existing = timers.get(key);
		if (existing !== undefined) window.clearTimeout(existing);
		timers.delete(key);
		set((state) => {
			const forConversation = state.typing[conversationID];
			if (!forConversation || !(userID in forConversation)) return state;
			const next = { ...forConversation };
			delete next[userID];
			return { typing: { ...state.typing, [conversationID]: next } };
		});
	},
}));
