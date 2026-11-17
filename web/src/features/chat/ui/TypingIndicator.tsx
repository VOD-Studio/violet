import { formatTypingLabel } from "../lib/format-typing-label";
import { useChatTypingStore } from "../model/chat-typing-store";
import type { ChatMember } from "../model/types";

export interface TypingIndicatorProps {
	/** 当前会话 ID。 */
	conversationID: string;
	/** 当前会话成员，用于把输入中的 userID 解析为展示名。 */
	members: ChatMember[];
}

/** 固定高度的会话输入状态位，空态保留占位且不参与键盘导航。 */
export function TypingIndicator({ conversationID, members }: TypingIndicatorProps) {
	const typingByUser = useChatTypingStore((s) => s.typing[conversationID]);
	const typingUserIDs = typingByUser ? Object.keys(typingByUser) : [];
	const names = typingUserIDs
		.map((userID) => members.find((member) => member.user.id === userID)?.user.display_name)
		.filter((name): name is string => Boolean(name));
	const label = formatTypingLabel(names);
	return (
		<div
			className="h-5 min-w-0 shrink-0 truncate px-4 pb-1 font-mono text-[11px] leading-4 text-muted-foreground/70 md:px-5"
			role="status"
			aria-live="polite"
			aria-atomic="true"
		>
			{label}
		</div>
	);
}
