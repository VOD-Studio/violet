import { create } from "zustand";

/**
 * ChatPresenceState - 成员在线状态的实时覆盖层
 *
 * 后端的 presence.updated 事件不持久化、不参与断线补发，前端因此也不经查询缓存：
 * 成员读模型里的 online 是进入会话时的快照，本 store 承载其后收到的实时变化，
 * 由 useChatStream 写入；SSE 重连时清空，以重新拉取的成员列表对账。
 */
export interface ChatPresenceState {
	/** userID -> 最近一次事件给出的在线状态；缺失表示以成员读模型为准 */
	overrides: Record<string, boolean>;
	setOnline: (userID: string, online: boolean) => void;
	reset: () => void;
}

export const useChatPresenceStore = create<ChatPresenceState>((set) => ({
	overrides: {},
	setOnline: (userID, online) =>
		set((state) => ({ overrides: { ...state.overrides, [userID]: online } })),
	reset: () => set({ overrides: {} }),
}));

/** 实时覆盖优先，缺失时回退成员读模型。 */
export function resolveOnline(
	overrides: Record<string, boolean>,
	userID: string,
	snapshot: boolean,
): boolean {
	return userID in overrides ? overrides[userID] : snapshot;
}
