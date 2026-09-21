/**
 * 消息气泡外壳与气泡外时间戳。
 */
import { formatDateTime, formatTime } from "@shared/lib/date";
import { cn } from "@shared/lib/utils";
import type { ReactNode } from "react";
import { BUBBLE_BY_ID } from "../model/appearance-catalog";
import { AppearanceBubbleSurface } from "./appearance/AppearanceBubbleSurface";

/**
 * 消息气泡容器：mine 为实色主色，other 为浅底。
 *
 * wrap-anywhere 而非 wrap-break-word：break-word 不参与 min-content 计算，
 * 长 URL 这类不可断词会把气泡（及其 flex 子项的自动最小尺寸）顶到 max-width 之外。
 * max-w-full 再兜住代码块等无法折行的内容：它们的 min-content 撑不小，只能被夹住后内部横向滚动。
 */
export interface BubbleShellProps {
	/** 保留既有的收/发消息对齐方式。 */
	mine: boolean;
	/** 既有的文本/图片/Markdown 内容。 */
	children: ReactNode;
	/** 空串或未知 ID 保持原气泡不变。 */
	themeId?: string;
}

export function BubbleShell({ mine, children, themeId = "" }: BubbleShellProps) {
	const theme = BUBBLE_BY_ID.get(themeId);
	if (theme)
		return (
			<AppearanceBubbleSurface theme={theme} mine={mine}>
				{children}
			</AppearanceBubbleSurface>
		);
	return (
		<div
			className={cn(
				"flex max-w-full flex-wrap items-end px-3.5 py-2 text-left text-[0.95rem] leading-relaxed wrap-anywhere",
				mine
					? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
					: "rounded-2xl rounded-bl-md bg-secondary text-foreground",
			)}
		>
			{children}
		</div>
	);
}

/**
 * 气泡外时间戳：常驻 DOM 但视觉隐藏，hover/焦点/长按时淡入。
 *
 * 放在头像外侧而非气泡下方：不额外占用行高，也不遮挡头像装饰。
 * editedAt 非空时前置「已编辑」标识，悬停可见最后编辑时间。
 */
export function BubbleTimestamp({
	time,
	editedAt,
	forceVisible = false,
	className,
}: {
	time: string;
	editedAt?: string;
	/** 触屏长按等操作态没有 hover，由调用方直接点亮。 */
	forceVisible?: boolean;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"whitespace-nowrap text-[10px] leading-4 tabular-nums text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100",
				forceVisible && "opacity-100",
				className,
			)}
		>
			{editedAt && (
				<span className="block" title={`编辑于 ${formatDateTime(editedAt, "long-minute")}`}>
					已编辑
				</span>
			)}
			<time className="block" dateTime={time} title={formatDateTime(time, "long-minute")}>
				{formatTime(time)}
			</time>
		</span>
	);
}
