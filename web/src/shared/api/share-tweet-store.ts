import { create } from "zustand";

/**
 * ShareTweetPreview - 分享到聊天时随身携带的推文展示信息
 *
 * 由发起分享的一方（TweetCard）在打开时一次性写入，避免 ShareTweetDialog
 * 与落地后的聊天输入框各自重新拉取推文详情。
 */
export interface ShareTweetPreview {
	id: string;
	authorUsername: string;
	content: string;
	imageUrl?: string;
}

/** 已选定目标会话、待聊天输入框落地发送的分享。 */
export interface PendingChatShare {
	conversationId: string;
	tweet: ShareTweetPreview;
}

/**
 * ShareTweetState - 「分享到聊天」跨 feature 协作状态
 *
 * `features/tweets` 的 TweetCard 与 `features/chat` 的 ShareTweetDialog/
 * MessageComposer 互不导入，经由本 store 协作：TweetCard 调 open() 弹出
 * 会话选择器，选择器 commit() 落定目标会话后交给聊天输入框读 pending 并清空。
 * 放在 shared/api 是因为它是两个 feature 的直接协作者，依赖方向应为
 * shared ← features（与 LoginDialogState/CommandUIState 同模式）。
 */
export interface ShareTweetState {
	/** 当前正在选择目标会话的推文；非空时 ShareTweetDialog 打开 */
	tweet: ShareTweetPreview | null;
	/** 已选定会话、待聊天输入框落地发送的分享 */
	pending: PendingChatShare | null;
	open: (tweet: ShareTweetPreview) => void;
	close: () => void;
	commit: (conversationId: string) => void;
	clearPending: () => void;
}

export const useShareTweetStore = create<ShareTweetState>((set, get) => ({
	tweet: null,
	pending: null,
	open: (tweet) => set({ tweet }),
	close: () => set({ tweet: null }),
	commit: (conversationId) => {
		const tweet = get().tweet;
		if (!tweet) return;
		set({ tweet: null, pending: { conversationId, tweet } });
	},
	clearPending: () => set({ pending: null }),
}));
