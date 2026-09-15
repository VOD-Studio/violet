import { MENTION_ALL } from "@entities/user/model/mention-token";
import type { MentionCandidate } from "@features/comments/ui/MentionSuggestions";
import { useMemo } from "react";
import { useChatMembers } from "../api/queries";
import type { ConversationKind } from "../model/types";

/**
 * 当前会话的 @ 提及候选：其他有效成员；房间额外提供全体提及。
 *
 * 成员列表复用 useChatMembers 的查询缓存——ConversationPanel 打开会话时已拉过，
 * composer 这里命中缓存，不额外发请求。
 */
export function useMentionCandidates(
	conversationID: string,
	selfID: string,
	kind: ConversationKind = "direct",
): MentionCandidate[] {
	const { data: members } = useChatMembers(conversationID);
	return useMemo(() => {
		const candidates = (members ?? [])
			.filter((member) => member.user.id !== selfID)
			.map((member) => ({
				id: member.user.id,
				username: member.user.username,
				displayName: member.user.display_name || member.user.username,
				avatarUrl: member.user.avatar_url || undefined,
			}));
		return kind === "room" && members?.some((member) => member.user.id === selfID)
			? [MENTION_ALL, ...candidates]
			: candidates;
	}, [members, selfID, kind]);
}
