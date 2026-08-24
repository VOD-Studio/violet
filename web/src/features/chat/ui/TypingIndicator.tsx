import { formatTypingLabel } from "../lib/format-typing-label";
import { useChatTypingStore } from "../model/chat-typing-store";
import type { ChatMember } from "../model/types";

export interface TypingIndicatorProps {
	/** 当前会话 ID。 */
	conversationID: string;
	/** 当前会话成员，用于把输入中的 userID 解析为展示名。 */
	members: ChatMember[];
}

/** 会话输入状态提示：无人输入时不渲染任何内容。 */
export function TypingIndicator({ conversationID, members }: TypingIndicatorProps) {
	const typingByUser = useChatTypingStore((s) => s.typing[conversationID]);
	const typingUserIDs = typingByUser ? Object.keys(typingByUser) : [];
	const names = typingUserIDs
		.map((userID) => members.find((member) => member.user.id === userID)?.user.display_name)
		.filter((name): name is string => Boolean(name));
	const label = formatTypingLabel(names);
	if (!label) return null;
	return (
		<div className="px-4 pb-1 font-mono text-[11px] text-muted-foreground/70 md:px-5">
			{label}
		</div>
	);
}
