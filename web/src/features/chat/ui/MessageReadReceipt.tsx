/**
 * 已读回执：自己发送消息的阅读状态。私聊显示「已读/未读」；房间显示聚合计数，点击弹出已读成员名单。
 */
import { formatDateTime } from "@shared/lib/date";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/ui/base/popover";
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
			<span className="px-1 text-[11px] leading-4 text-muted-foreground">
				{state.read_count > 0 ? "已读" : "未读"}
			</span>
		);
	}

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<button
					className="rounded px-1 text-[11px] leading-4 text-muted-foreground transition-colors hover:text-foreground"
					type="button"
				>
					{state.read_count} 人已读
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-56 p-1.5"
				onCloseAutoFocus={(event) => {
					if (!mentioning.current) return;
					// 提及时输入框已获得焦点，关闭浮层不能再把焦点抢回回执按钮。
					event.preventDefault();
					mentioning.current = false;
				}}
			>
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
