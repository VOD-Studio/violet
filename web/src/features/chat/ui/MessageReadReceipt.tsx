/**
 * 已读回执：自己发送消息的阅读状态。私聊显示「已读/未读」；房间显示聚合计数，点击弹出已读成员名单。
 */
import { formatDateTime } from "@shared/lib/date";
import { Popover, PopoverContent, PopoverTrigger } from "@violet/ui";

import { Check, CheckCheck } from "lucide-react";
import { useRef, useState } from "react";
import { useChatMessageReaders } from "../api/queries";
import type { ChatMessage, ChatUser, ConversationKind } from "../model/types";
import { ChatAvatar } from "./ChatAvatar";

interface MessageReadReceiptProps {
	/** 自己发送的消息；read_state 缺省时整体不渲染。 */
	message: ChatMessage;
	/** 会话形态：私聊显示已读/未读，房间显示聚合计数与名单。 */
	conversationKind: ConversationKind;
	/** 点击已读成员名字时追加提及。 */
	onMention?: (user: ChatUser) => void;
}

export function MessageReadReceipt({
	message,
	conversationKind,
	onMention,
}: MessageReadReceiptProps) {
	const [open, setOpen] = useState(false);
	const mentioning = useRef(false);
	const {
		data: readers,
		isLoading,
		isError,
	} = useChatMessageReaders(
		message.conversation_id,
		message.id,
		open && conversationKind === "room",
	);
	const state = message.read_state;
	if (!state) return null;

	if (conversationKind === "direct") {
		return (
			<span className="inline-flex items-center text-current/60">
				{state.read_count > 0 ? (
					<CheckCheck aria-hidden="true" className="size-3.5" />
				) : (
					<Check aria-hidden="true" className="size-3.5" />
				)}
				<span className="sr-only">{state.read_count > 0 ? "已读" : "未读"}</span>
			</span>
		);
	}

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<button
					aria-label={`${state.read_count} 人已读`}
					className="inline-flex items-center gap-0.5 rounded px-0.5 text-[11px] leading-4 text-current/60 transition-colors hover:text-current focus-visible:outline-2 focus-visible:outline-ring"
					type="button"
				>
					{state.read_count > 0 ? (
						<>
							<CheckCheck aria-hidden="true" className="size-3.5" />
							<span aria-hidden="true">{state.read_count}</span>
						</>
					) : (
						<Check aria-hidden="true" className="size-3.5" />
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-56 min-w-0 p-1.5"
				onCloseAutoFocus={(event) => {
					if (!mentioning.current) return;
					// 提及时输入框已获得焦点，关闭浮层不能再把焦点抢回回执按钮。
					event.preventDefault();
					mentioning.current = false;
				}}
			>
				<p className="px-2 pb-1 pt-1.5 text-xs font-medium text-foreground">
					已读 {state.read_count} · 未读{" "}
					{Math.max(state.member_count - state.read_count, 0)}
				</p>
				{isLoading ? (
					<p className="px-2 py-3 text-center text-xs text-muted-foreground">加载中…</p>
				) : isError ? (
					<p className="px-2 py-3 text-center text-xs text-muted-foreground">
						已读名单加载失败
					</p>
				) : !readers?.length ? (
					<p className="px-2 py-3 text-center text-xs text-muted-foreground">
						暂无已读成员
					</p>
				) : (
					<ul className="max-h-60 overflow-y-auto">
						{readers.map((reader) => (
							<li
								className="flex items-center gap-2 rounded-md px-2 py-1.5"
								key={reader.user.id}
							>
								<ChatAvatar className="size-6 shrink-0" user={reader.user} />
								<div className="min-w-0 flex-1">
									<button
										aria-label={`提及 ${reader.user.display_name}`}
										className="block max-w-full rounded text-left text-sm wrap-anywhere text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
										disabled={!onMention}
										onClick={() => {
											mentioning.current = true;
											setOpen(false);
											onMention?.(reader.user);
										}}
										type="button"
									>
										{reader.user.display_name}
									</button>
									<span className="block text-[11px] text-muted-foreground">
										{formatDateTime(reader.read_at, "long-minute")}
									</span>
								</div>
							</li>
						))}
					</ul>
				)}
			</PopoverContent>
		</Popover>
	);
}
