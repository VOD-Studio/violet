import { cn } from "cn";
import type { ReactNode } from "react";
import { BASIC_BUBBLE_BY_ID } from "../../model/appearance-catalog";
import styles from "./BasicBubbleSurface.module.css";

/** 空 ID 是原有季节款;未登记 ID 由 BubbleShell 的既有兜底处理。 */
export function isBasicBubbleTheme(themeId: string): boolean {
	return BASIC_BUBBLE_BY_ID.has(themeId);
}

/** 基础款保留真实消息内容与收发方向,时间戳由调用方放在气泡之外。 */
export interface BasicBubbleSurfaceProps {
	themeId: string;
	mine: boolean;
	children: ReactNode;
	lastInGroup?: boolean;
}

export function BasicBubbleSurface({
	themeId,
	mine,
	children,
	lastInGroup = true,
}: BasicBubbleSurfaceProps) {
	return (
		<div
			className={cn(styles.bubble, themeId === "" && !mine && styles.incoming)}
			data-chat-bubble-theme={themeId || "season"}
			data-side={mine ? "outgoing" : "incoming"}
			data-chat-bubble=""
			data-last-in-group={lastInGroup}
		>
			{children}
		</div>
	);
}
