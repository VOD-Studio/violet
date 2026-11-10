import { MENTION_ALL } from "@entities/user/model/mention-token";
import type { MentionCandidate } from "@violet/ui";
import { useMemo } from "react";
import { useChatMembers, useChatMessages } from "../api/queries";
import type { ConversationKind } from "../model/types";

/** 推断「最近发言者」时回看的消息条数；只看仍在缓存里的最近一屏，不额外拉取。 */
const RECENT_MESSAGE_WINDOW = 40;

/**
 * 当前会话的 @ 提及候选：其他有效成员，最近发言者排前；房间额外把「全体成员」置顶并带上人数。
 *
 * 成员与消息都复用会话面板已经拉过的查询缓存，composer 这里不额外发请求。
 */
export function useMentionCandidates(
	conversationID: string,
	selfID: string,
	kind: ConversationKind = "direct",
): MentionCandidate[] {
	const { data: members } = useChatMembers(conversationID);
	const { data: messagePages } = useChatMessages(conversationID);
	return useMemo(() => {
		const memberList = members ?? [];
		const candidates = memberList
			.filter((member) => member.user.id !== selfID)
			.map((member) => ({
				id: member.user.id,
				username: member.user.username,
				displayName: member.user.display_name || member.user.username,
				avatarUrl: member.user.avatar_url || undefined,
				role: member.role,
				isBot: member.user.is_bot,
			}));
		const byID = new Map(candidates.map((candidate) => [candidate.id, candidate]));

		// 分页之间与页内顺序都不可靠，按时间排一遍再从尾部往前收发言者
		const timeline = (messagePages?.pages ?? [])
			.flatMap((page) => page.data)
			.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
		const newestFirst: MentionCandidate[] = [];
		const seen = new Set<string>();
		const start = Math.max(0, timeline.length - RECENT_MESSAGE_WINDOW);
		for (let index = timeline.length - 1; index >= start; index--) {
			const senderID = timeline[index].sender.id;
			const candidate = byID.get(senderID);
			if (!candidate || seen.has(senderID)) continue;
			seen.add(senderID);
			newestFirst.push(candidate);
		}

		const rest = candidates.filter((candidate) => !seen.has(candidate.id));
		const broadcast =
			kind === "room" && memberList.some((member) => member.user.id === selfID)
				? [{ ...MENTION_ALL, memberCount: memberList.length }]
				: [];
		return [...broadcast, ...newestFirst, ...rest];
	}, [members, messagePages, selfID, kind]);
}
