import { cn } from "cn";
import { type ChatBackground, useChatBackgroundStore } from "../../model/appearance-background";
import styles from "./ChatBackground.module.css";

/** 预览只使用传入草稿,不读取或写入已保存偏好。 */
export function chatBackgroundClassName(background: ChatBackground): string {
	return cn(styles.background, styles[background]);
}

/** 返回当前账号已保存的背景类名,用于 ConversationPanel 的消息与输入共同容器。 */
export function useChatBackground(userID: string): string {
	const background = useChatBackgroundStore((state) => state.backgrounds[userID] ?? "paper");
	return chatBackgroundClassName(background);
}
