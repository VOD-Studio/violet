import { formatDate } from "@shared/lib/date";
import { Fragment, type ReactNode, useMemo } from "react";
import type { ChatMessage } from "../model/types";
import { ChatAvatar } from "./ChatAvatar";

type TimelineUnit =
	| { kind: "date"; date: string; id: string }
	| { kind: "system"; message: ChatMessage }
	| { kind: "group"; messages: ChatMessage[] };
interface ConversationTimelineProps {
	messages: ChatMessage[];
	currentUserID: string;
	renderMessage: (message: ChatMessage, first: boolean, last: boolean) => ReactNode;
}

/** 日期和系统事件打断连续消息；只在接收侧保留一枚组头像。 */
export function ConversationTimeline({
	messages,
	currentUserID,
	renderMessage,
}: ConversationTimelineProps) {
	const units = useMemo(() => {
		const result: TimelineUnit[] = [];
		let day = "";
		let group: Extract<TimelineUnit, { kind: "group" }> | null = null;
		for (const message of messages) {
			const currentDay = new Date(message.created_at).toDateString();
			if (currentDay !== day) {
				day = currentDay;
				group = null;
				result.push({ kind: "date", date: message.created_at, id: day });
			}
			if (message.type === "system") {
				group = null;
				result.push({ kind: "system", message });
				continue;
			}
			const previous = group?.messages.at(-1);
			if (
				previous &&
				previous.sender.id === message.sender.id &&
				Date.parse(message.created_at) - Date.parse(previous.created_at) < 5 * 60_000
			) {
				group?.messages.push(message);
			} else {
				group = { kind: "group", messages: [message] };
				result.push(group);
			}
		}
		return result;
	}, [messages]);
	const today = new Date().toDateString();
	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	return (
		<>
			{units.map((unit) => {
				if (unit.kind === "date") {
					const day = new Date(unit.date).toDateString();
					return (
						<div key={unit.id} className="flex justify-center py-2">
							<span className="rounded-full bg-card/85 px-2.5 py-0.5 text-xs text-muted-foreground">
								{day === today
									? "今天"
									: day === yesterday.toDateString()
										? "昨天"
										: formatDate(unit.date, "long-month-day")}
							</span>
						</div>
					);
				}
				if (unit.kind === "system") {
					return (
						<Fragment key={unit.message.id}>
							{renderMessage(unit.message, false, true)}
						</Fragment>
					);
				}
				const first = unit.messages[0];
				const mine = first.sender.id === currentUserID;
				return (
					<div
						key={first.client_message_id ?? first.id}
						className="relative grid grid-cols-1"
						style={{ gridTemplateRows: `repeat(${unit.messages.length * 2}, auto)` }}
					>
						{unit.messages.map((message, index) => (
							<Fragment key={message.client_message_id ?? message.id}>
								{renderMessage(
									message,
									index === 0,
									index === unit.messages.length - 1,
								)}
							</Fragment>
						))}
						{!mine && (
							<div className="pointer-events-none absolute inset-y-0 left-0 row-start-1 -row-end-2 flex w-9 flex-col-reverse">
								<div className="pointer-events-auto sticky bottom-2 top-0">
									<ChatAvatar user={first.sender} className="size-9" />
								</div>
							</div>
						)}
					</div>
				);
			})}
		</>
	);
}
