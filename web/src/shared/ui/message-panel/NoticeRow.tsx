import { Avatar } from "@violet/ui";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { ROW_CLASS } from "./row";
import type { NoticeEntry } from "./types";

/** 整行读成一句：谁、做了什么、原文，再接时间与未读。 */
function readAloud({ actor, text, quote, time, unread }: NoticeEntry) {
	const sentence = `${actor ? `${actor.name} ` : ""}${text}${quote ? `：${quote}` : ""}`;
	return `${/[。！？!?…]$/.test(sentence) ? sentence : `${sentence}。`}${time}${unread ? "，未读" : ""}`;
}

/** 通知行的属性；其余属性与 ref 落在按钮上，供 ListHighlightItem 这类包装直接接管。 */
export interface NoticeRowProps
	extends Omit<ComponentProps<"button">, "children" | "onClick" | "type"> {
	notice: NoticeEntry;
	onSelect: () => void;
}

/** 通知列表里的一行；整行是按钮。 */
export function NoticeRow({ notice, onSelect, className, ...props }: NoticeRowProps) {
	const { actor, icon: Icon, text, quote, time, unread } = notice;
	return (
		<button
			{...props}
			type="button"
			aria-label={readAloud(notice)}
			onClick={onSelect}
			className={cn(ROW_CLASS, className)}
		>
			{actor ? (
				<span className="relative size-9 shrink-0">
					{/* 设计稿的头像是 36px，不在 Avatar 的档位里：取最近一档，再改它的尺寸变量 */}
					<Avatar
						size={40}
						name={actor.name}
						src={actor.avatar}
						alt=""
						className="[--v-avatar-size:2.25rem]"
					/>
					<span
						aria-hidden="true"
						className="absolute -right-1 -bottom-1 flex size-5.5 items-center justify-center rounded-full border-2 border-background bg-popover text-muted-foreground"
					>
						<Icon className="size-3" strokeWidth={1.75} />
					</span>
				</span>
			) : (
				<span
					aria-hidden="true"
					className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
				>
					<Icon className="size-4.5" strokeWidth={1.75} />
				</span>
			)}
			<span className="flex min-w-0 flex-1 flex-col">
				<span
					className={cn(
						"text-14",
						unread ? "font-semibold text-foreground" : "text-muted-foreground",
					)}
				>
					{actor ? (
						<b
							className={cn(
								"mr-1.5 text-foreground",
								unread ? "font-semibold" : "font-medium",
							)}
						>
							{actor.name}
						</b>
					) : null}
					{text}
				</span>
				{quote ? (
					<span className="truncate text-13 leading-normal text-muted-foreground">
						「{quote}」
					</span>
				) : null}
			</span>
			<span className="flex shrink-0 flex-col items-end gap-2 text-12 text-muted-foreground">
				<span className="tabular-nums">{time}</span>
				{unread ? (
					<span aria-hidden="true" className="size-2 rounded-full bg-destructive" />
				) : null}
			</span>
		</button>
	);
}
