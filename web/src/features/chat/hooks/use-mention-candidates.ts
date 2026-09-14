import type { MentionCandidate } from "@features/comments/ui/MentionSuggestions";
import { useMemo } from "react";
import { useChatMembers } from "../api/queries";

/**
 * 当前会话的 @ 提及候选：有效成员减去自己（@ 自己没有提醒语义）。
 *
 * 成员列表复用 useChatMembers 的查询缓存——ConversationPanel 打开会话时已拉过，
 * composer 这里命中缓存，不额外发请求。
 */
export function useMentionCandidates(conversationID: string, selfID: string): MentionCandidate[] {
	const { data: members } = useChatMembers(conversationID);
	return useMemo(
		() =>
			(members ?? [])
				.filter((member) => member.user.id !== selfID)
				.map((member) => ({
					id: member.user.id,
					username: member.user.username,
					displayName: member.user.display_name || member.user.username,
					avatarUrl: member.user.avatar_url || undefined,
				})),
		[members, selfID],
	);
}
