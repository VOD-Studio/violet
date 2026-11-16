import { cn } from "cn";
import type { ReactNode } from "react";
import { BASIC_BUBBLE_BY_ID } from "../../model/appearance-catalog";
import styles from "./BasicBubbleSurface.module.css";
import surfaceStyles from "./BubbleSurface.module.css";

/** 空 ID 是原有季节款;未登记 ID 由 BubbleShell 的既有兜底处理。 */
export function isBasicBubbleTheme(themeId: string): boolean {
	return BASIC_BUBBLE_BY_ID.has(themeId);
}

/** 基础款保留真实消息内容、状态与收发方向。 */
export interface BasicBubbleSurfaceProps {
	themeId: string;
	mine: boolean;
	children: ReactNode;
	firstInGroup?: boolean;
	lastInGroup?: boolean;
}

export function BasicBubbleSurface({
	themeId,
	mine,
	children,
	firstInGroup = true,
	lastInGroup = true,
}: BasicBubbleSurfaceProps) {
	return (
		<div
			className={cn(
				surfaceStyles.surface,
				styles.bubble,
				themeId === "" && !mine && styles.incoming,
			)}
			data-chat-bubble-theme={themeId || "season"}
			data-side={mine ? "outgoing" : "incoming"}
			data-chat-bubble=""
			data-first-in-group={firstInGroup}
			data-last-in-group={lastInGroup}
		>
			{children}
		</div>
	);
}
