/** 消息气泡与气泡外的时间戳。 */
import { formatDateTime, formatTime } from "@shared/lib/date";
import { cn } from "cn";
import type { ReactNode } from "react";
import { BUBBLE_BY_ID } from "../model/appearance-catalog";
import { AppearanceBubbleSurface } from "./appearance/AppearanceBubbleSurface";
import { BasicBubbleSurface, isBasicBubbleTheme } from "./appearance/BasicBubbleSurface";

/**
 * 消息气泡容器，默认发送侧使用季节底色、接收侧使用纸面。
 *
 * @remarks 内容通过 wrap-anywhere 参与最小宽度计算，长代码在块内横向滚动。
 * 代码块与富卡片的可用宽度由 MessageBubble 的消息列和正文共同提供。
 */
export interface BubbleShellProps {
	/** 保留既有的收/发消息对齐方式。 */
	mine: boolean;
	/** 既有的文本/图片/Markdown 内容。 */
	children: ReactNode;
	/** 空串为季节基础款；未知或下架 ID 退回默认样式。 */
	themeId?: string;
	/** 首尾位置决定基础气泡靠发送侧的连接圆角。 */
	firstInGroup?: boolean;
	lastInGroup?: boolean;
}

export function BubbleShell({
	mine,
	children,
	themeId = "",
	firstInGroup = true,
	lastInGroup = true,
}: BubbleShellProps) {
	const theme = BUBBLE_BY_ID.get(themeId);
	const body = <div className="min-w-0 w-full">{children}</div>;
	if (isBasicBubbleTheme(themeId)) {
		return (
			<BasicBubbleSurface
				themeId={themeId}
				mine={mine}
				firstInGroup={firstInGroup}
				lastInGroup={lastInGroup}
			>
				{body}
			</BasicBubbleSurface>
		);
	}
	if (theme) {
		return (
			<AppearanceBubbleSurface theme={theme} mine={mine}>
				{body}
			</AppearanceBubbleSurface>
		);
	}
	return (
		<BasicBubbleSurface
			themeId=""
			mine={mine}
			firstInGroup={firstInGroup}
			lastInGroup={lastInGroup}
		>
			{body}
		</BasicBubbleSurface>
	);
}

/** 时间与编辑标记共用一行，完整日期通过原生提示提供。 */
export function BubbleTimestamp({
	time,
	editedAt,
	className,
}: {
	time: string;
	editedAt?: string;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 whitespace-nowrap text-xs leading-4 tabular-nums text-muted-foreground",
				className,
			)}
		>
			{editedAt && (
				<span title={`编辑于 ${formatDateTime(editedAt, "long-minute")}`}>已编辑</span>
			)}
			<time dateTime={time} title={formatDateTime(time, "long-minute")}>
				{formatTime(time)}
			</time>
		</span>
	);
}
