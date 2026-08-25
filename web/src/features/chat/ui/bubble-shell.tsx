/**
 * 消息气泡外壳与内嵌时间戳。
 */
import { cn } from "@shared/lib/utils";
import type { ReactNode } from "react";
import { formatTime } from "../lib/conversation";

/** 消息气泡容器：mine 为实色主色，other 为浅底。 */
export function BubbleShell({ mine, children }: { mine: boolean; children: ReactNode }) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-end gap-x-1.5 px-3.5 py-2 text-left text-[0.95rem] leading-relaxed",
				mine
					? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
					: "rounded-2xl rounded-bl-md bg-secondary text-foreground",
			)}
		>
			{children}
		</div>
	);
}

/** 气泡内时间戳：随正文行尾流动，mine 半透明白、other 弱化灰。 */
export function BubbleTimestamp({
	mine,
	time,
	inline = false,
	className,
}: {
	mine: boolean;
	time: string;
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
			{formatTime(time)}
		</span>
	);
}
