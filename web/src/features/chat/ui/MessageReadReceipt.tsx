import { formatDateTime } from "@shared/lib/date";
import { iconProps, Popover, PopoverContent, PopoverTrigger } from "@violet/ui";
import { cn } from "cn";

import { Check, CheckCheck } from "lucide-react";
import { type RefObject, useRef } from "react";
import { useChatMessageReaders } from "../api/queries";
import type { ChatMessage, ChatUser, ConversationKind } from "../model/types";
import { ChatAvatar } from "./ChatAvatar";

/** 组尾回执与逐条消息菜单共用已读成员名单。 */
export interface MessageReadReceiptProps {
	/** 自己发送的消息；非 pending 时缺少 read_state 不渲染。 */
	message: ChatMessage;
	/** 会话形态：私聊显示已读/未读，房间显示聚合计数与名单。 */
	conversationKind: ConversationKind;
	/** 发送中保留回执尺寸，但不显示或开放名单交互。 */
	pending?: boolean;
	/** 点击已读成员名字时追加提及。 */
	onMention?: (user: ChatUser) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 非组尾只保留定位锚点，名单由消息菜单打开。 */
	collapsed?: boolean;
	returnFocusRef: RefObject<HTMLButtonElement | null>;
}

/** 气泡外的阅读状态，房间回执可展开成员名单。 */
export function MessageReadReceipt({
	message,
	conversationKind,
	onMention,
	pending = false,
	open,
	onOpenChange,
	collapsed = false,
	returnFocusRef,
}: MessageReadReceiptProps) {
	const mentioning = useRef(false);
	const {
		data: readers,
		isLoading,
		isError,
	} = useChatMessageReaders(
		message.conversation_id,
		message.id,
		!pending && open && conversationKind === "room",
	);
	const state = message.read_state;
	if (!state && !pending) return null;
	const readCount = state?.read_count ?? 0;
	const memberCount = state?.member_count ?? 0;

	if (conversationKind === "direct") {
		if (collapsed) return null;
		return (
			<span
				aria-hidden={pending || undefined}
				className={cn(
					"inline-flex items-center gap-1 text-xs leading-4 text-muted-foreground",
					pending && "invisible",
				)}
			>
				{readCount > 0 ? (
					<CheckCheck aria-hidden="true" {...iconProps(14)} />
				) : (
					<Check aria-hidden="true" {...iconProps(14)} />
				)}
				{!pending && <span className="sr-only">{readCount > 0 ? "已读" : "未读"}</span>}
			</span>
		);
	}

	return (
		<Popover onOpenChange={onOpenChange} open={!pending && open}>
			<PopoverTrigger asChild>
				<button
					aria-hidden={pending || collapsed || undefined}
					aria-label={`${readCount} 人已读`}
					className={cn(
						"inline-flex items-center gap-1 rounded px-0.5 text-xs leading-4 tabular-nums text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
						pending && "invisible",
						collapsed && "pointer-events-none absolute right-0 top-0 opacity-0",
					)}
					disabled={pending}
					tabIndex={collapsed ? -1 : undefined}
					type="button"
				>
					{readCount > 0 ? (
						<>
							<CheckCheck aria-hidden="true" {...iconProps(14)} />
							<span aria-hidden="true">{readCount}</span>
						</>
					) : (
						<Check aria-hidden="true" {...iconProps(14)} />
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent
				aria-label="已读成员"
				align="end"
				className="w-56 min-w-0 p-1.5"
				onCloseAutoFocus={(event) => {
					if (mentioning.current) {
						// 提及时输入框已获得焦点，不能再把焦点抢回回执。
						event.preventDefault();
						mentioning.current = false;
					} else if (collapsed) {
						event.preventDefault();
						const active = document.activeElement;
						if (
							!active ||
							active === document.body ||
							(event.target instanceof HTMLElement && event.target.contains(active))
						) {
							returnFocusRef.current?.focus({ preventScroll: true });
						}
					}
				}}
			>
				<p className="px-2 pb-1 pt-1.5 text-xs font-medium text-foreground">
					已读 {readCount} · 未读 {Math.max(memberCount - readCount, 0)}
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
											onOpenChange(false);
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
