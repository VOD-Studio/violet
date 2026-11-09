import { Avatar } from "@violet/ui";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { ROW_CLASS } from "./row";
import type { ChatEntry } from "./types";

/** 会话行的属性；其余属性与 ref 落在按钮上，供 ListHighlightItem 这类包装直接接管。 */
export interface ChatRowProps
	extends Omit<ComponentProps<"button">, "children" | "onClick" | "type"> {
	entry: ChatEntry;
	onSelect: () => void;
}

/** 聊天标签里的一个会话：名字与最新一条时间，下一行是摘要与未读数。 */
export function ChatRow({ entry, onSelect, className, ...props }: ChatRowProps) {
	const { name, avatar, preview, time, unread } = entry;
	return (
		<button
			{...props}
			type="button"
			aria-label={`${name}，${preview}，${time}${unread > 0 ? `，${unread} 条未读` : ""}`}
			onClick={onSelect}
			className={cn(ROW_CLASS, className)}
		>
			<Avatar size={32} name={name} src={avatar} alt="" />
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="flex items-baseline justify-between gap-3">
					<span
						className={cn(
							"truncate text-13 leading-normal",
							unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground",
						)}
					>
						{name}
					</span>
					<span className="shrink-0 text-12 tabular-nums text-muted-foreground">
						{time}
					</span>
				</span>
				<span className="flex items-center justify-between gap-3">
					<span className="truncate text-12 leading-normal text-muted-foreground">
						{preview}
					</span>
					{unread > 0 ? (
						<span
							aria-hidden="true"
							className="inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-foreground px-1.25 text-[10px] font-semibold tabular-nums text-background"
						>
							{unread > 99 ? "99+" : unread}
						</span>
					) : null}
				</span>
			</span>
		</button>
	);
}
