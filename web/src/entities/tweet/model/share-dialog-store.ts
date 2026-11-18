import { create } from "zustand";

interface ShareTweetState {
	tweetId: string | null;
	open: (id: string) => void;
	close: () => void;
}

/** 打开指定公开推文的分享面板。 */
export const useShareTweetStore = create<ShareTweetState>((set) => ({
	tweetId: null,
	open: (tweetId) => set({ tweetId }),
	close: () => set({ tweetId: null }),
}));
