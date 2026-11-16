import { create } from "zustand";
import { persist } from "zustand/middleware";

/** 背景只影响当前浏览器,以登录账号隔离。 */
export const CHAT_BACKGROUNDS = [
	{ id: "paper", name: "纸纹" },
	{ id: "solid", name: "纯色" },
	{ id: "season", name: "季节" },
] as const;

export type ChatBackground = (typeof CHAT_BACKGROUNDS)[number]["id"];

interface ChatBackgroundState {
	backgrounds: Record<string, ChatBackground>;
	setBackground: (userID: string, background: ChatBackground) => void;
}

function isChatBackground(value: unknown): value is ChatBackground {
	return value === "paper" || value === "solid" || value === "season";
}

/** 编辑器仅在保存完成后写入;未保存草稿不进入持久化状态。 */
export const useChatBackgroundStore = create<ChatBackgroundState>()(
	persist(
		(set) => ({
			backgrounds: {},
			setBackground: (userID, background) => {
				if (!userID) {
					return;
				}
				set((state) => ({ backgrounds: { ...state.backgrounds, [userID]: background } }));
			},
		}),
		{
			name: "violet:chat-backgrounds",
			partialize: (state) => ({ backgrounds: state.backgrounds }),
			merge: (persisted, current) => {
				const backgrounds: Record<string, ChatBackground> = {};
				if (persisted && typeof persisted === "object" && "backgrounds" in persisted) {
					const values = persisted.backgrounds;
					if (values && typeof values === "object") {
						for (const [userID, background] of Object.entries(values)) {
							if (userID && isChatBackground(background)) {
								backgrounds[userID] = background;
							}
						}
					}
				}
				return { ...current, backgrounds };
			},
		},
	),
);
