import { useContext } from "react";
import { EMPTY_APPEARANCE } from "../model/appearance-catalog";
import { ChatAppearanceContext } from "../model/appearance-context";

/** 一律按消息/头像的属主解析外观,与当前浏览账号无关。 */
export function useChatAppearance(userID: string) {
	const scope = useContext(ChatAppearanceContext);
	return scope?.values[userID.toLowerCase()] ?? EMPTY_APPEARANCE;
}
