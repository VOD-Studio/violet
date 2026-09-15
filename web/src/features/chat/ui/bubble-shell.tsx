/**
 * 消息气泡外壳与内嵌时间戳。
 */
import { formatDateTime, formatTime } from "@shared/lib/date";
import { cn } from "@shared/lib/utils";
import type { ReactNode } from "react";

/**
 * 消息气泡容器：mine 为实色主色，other 为浅底。
 *
 * wrap-anywhere 而非 wrap-break-word：break-word 不参与 min-content 计算，
 * 长 URL 这类不可断词会把气泡（及其 flex 子项的自动最小尺寸）顶到 max-width 之外。
 * max-w-full 再兜住代码块等无法折行的内容：它们的 min-content 撑不小，只能被夹住后内部横向滚动。
 */
export function BubbleShell({ mine, children }: { mine: boolean; children: ReactNode }) {
	return (
		<div
			className={cn(
				"flex max-w-full flex-wrap items-end gap-x-1.5 px-3.5 py-2 text-left text-[0.95rem] leading-relaxed wrap-anywhere",
				mine
					? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
					: "rounded-2xl rounded-bl-md bg-secondary text-foreground",
			)}
		>
			{children}
		</div>
	);
}

/** 气泡内时间戳：随正文行尾流动，mine 半透明白、other 弱化灰。editedAt 非空时前置「已编辑」标识，悬停可见最后编辑时间。 */
export function BubbleTimestamp({
	mine,
	time,
	editedAt,
	inline = false,
	className,
}: {
	mine: boolean;
	time: string;
	editedAt?: string;
	inline?: boolean;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"ml-auto inline-block whitespace-nowrap text-[11px] leading-5 tabular-nums",
				mine ? "text-primary-foreground/60" : "text-muted-foreground",
				inline && "float-right translate-y-0.5",
				className,
			)}
		>
			{editedAt && (
				<span title={`编辑于 ${formatDateTime(editedAt, "long-minute")}`}>已编辑 · </span>
			)}
			{formatTime(time)}
		</span>
	);
}
