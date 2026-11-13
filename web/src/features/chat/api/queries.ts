import {
	addSelfReaction,
	captureReaction,
	removeSelfReaction,
	restoreReaction,
} from "@entities/reaction/lib/optimistic";
import type { AggregatedReaction } from "@entities/reaction/model/types";
import { useMe } from "@features/auth/api/queries";
import { findCachedEmoji } from "@features/emojis/api/cache";
import type { PagedResponse } from "@shared/api/types";
import {
	type InfiniteData,
	type QueryClient,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import {
	type ChatSendRequest,
	enqueueChatMessage,
	reconcileChatOutbox,
} from "../model/chat-outbox";
import type {
	ChatMessage,
	CreateConversationInput,
	EditChatMessageInput,
	PushSubscriptionInput,
} from "../model/types";
import {
	addChatMessageReaction,
	createChatConversation,
	deleteChatMessage,
	deleteChatPushSubscription,
	editChatMessage,
	fetchBotCommands,
	fetchChatContacts,
	fetchChatConversation,
	fetchChatConversations,
	fetchChatMembers,
	fetchChatMessageReaders,
	fetchChatMessages,
	fetchChatPushConfig,
	fetchChatUnreadCount,
	fetchChatUser,
	inviteChatMember,
	leaveChatConversation,
	markChatRead,
	removeChatMember,
	removeChatMessageReaction,
	renameChatConversation,
	saveChatPushSubscription,
	setChatMuted,
} from "./client";
import { chatKeys } from "./keys";

export const useChatConversations = (enabled = true) =>
	useQuery({
		queryKey: chatKeys.conversations(),
		queryFn: () => fetchChatConversations(),
		enabled,
	});

export const useChatContacts = (query: string, enabled = true) =>
	useInfiniteQuery({
		queryKey: chatKeys.contacts(query),
		queryFn: ({ pageParam }) => fetchChatContacts(query, pageParam),
		initialPageParam: "",
		getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined,
		enabled,
		staleTime: 30_000,
	});

export const useChatConversation = (id: string | null) =>
	useQuery({
		queryKey: id ? chatKeys.conversation(id) : chatKeys.root,
		queryFn: () => fetchChatConversation(id as string),
		enabled: Boolean(id),
	});

export const useChatMembers = (id: string | null) =>
	useQuery({
		queryKey: id ? chatKeys.members(id) : chatKeys.root,
		queryFn: () => fetchChatMembers(id as string),
		enabled: Boolean(id),
	});

export const useBotCommands = (id: string, menuOpen = false) =>
	useQuery({
		queryKey: chatKeys.botCommands(id),
		queryFn: () => fetchBotCommands(id),
		staleTime: 30_000,
		refetchInterval: menuOpen ? 30_000 : false,
		retry: false,
	});

export const useChatMessages = (id: string | null) => {
	const query = useInfiniteQuery({
		queryKey: id ? chatKeys.messages(id) : chatKeys.root,
		queryFn: ({ pageParam, signal }) =>
			fetchChatMessages(id as string, pageParam || undefined, 50, signal),
		initialPageParam: "",
		getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined,
		enabled: Boolean(id),
	});
	useEffect(() => {
		if (query.data) reconcileChatOutbox(query.data.pages.flatMap((page) => page.data));
	}, [query.data]);
	return query;
};
/**
 * 消息已读成员名单（仅发送者可用）。
 *
 * @default 房间回执弹层打开时加载
 */
export const useChatMessageReaders = (conversationID: string, messageID: string, enabled = false) =>
	useQuery({
		queryKey: chatKeys.messageReaders(conversationID, messageID),
		queryFn: () => fetchChatMessageReaders(conversationID, messageID),
		enabled,
	});

export const useChatUnreadCount = (enabled = true) =>
	useQuery({
		queryKey: chatKeys.unreadCount(),
		queryFn: fetchChatUnreadCount,
		refetchInterval: 60_000,
		enabled,
	});

export const useChatUser = (username: string) =>
	useQuery({
		queryKey: chatKeys.user(username),
		queryFn: () => fetchChatUser(username),
		enabled: username.trim().length >= 3,
		retry: false,
	});

export const useCreateChatConversation = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateConversationInput) => createChatConversation(input),
		onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.conversations() }),
	});
};

export const useRenameChatConversation = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, title }: { id: string; title: string }) =>
			renameChatConversation(id, title),
		onSuccess: (conversation) => {
			qc.setQueryData(chatKeys.conversation(conversation.id), conversation);
			qc.invalidateQueries({ queryKey: chatKeys.conversations() });
		},
	});
};

export const useInviteChatMember = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, userId }: { id: string; userId: string }) =>
			inviteChatMember(id, userId),
		onSuccess: (_, variables) => {
			qc.invalidateQueries({ queryKey: chatKeys.conversation(variables.id) });
			qc.invalidateQueries({ queryKey: chatKeys.members(variables.id) });
			qc.invalidateQueries({ queryKey: chatKeys.conversations() });
		},
	});
};

export const useLeaveChatConversation = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => leaveChatConversation(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.conversations() }),
	});
};

export const useRemoveChatMember = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, userId }: { id: string; userId: string }) =>
			removeChatMember(id, userId),
		onSuccess: (_, variables) => {
			qc.invalidateQueries({ queryKey: chatKeys.conversation(variables.id) });
			qc.invalidateQueries({ queryKey: chatKeys.members(variables.id) });
			qc.invalidateQueries({ queryKey: chatKeys.conversations() });
		},
	});
};

export const useSetChatMuted = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, muted }: { id: string; muted: boolean }) => setChatMuted(id, muted),
		onSuccess: (_, variables) => {
			qc.invalidateQueries({ queryKey: chatKeys.conversation(variables.id) });
			qc.invalidateQueries({ queryKey: chatKeys.conversations() });
		},
	});
};

export const useDeleteChatMessage = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			conversationID,
			messageID,
		}: {
			conversationID: string;
			messageID: string;
		}) => deleteChatMessage(conversationID, messageID),
		onSuccess: (_, variables) => {
			qc.invalidateQueries({ queryKey: chatKeys.messages(variables.conversationID) });
			qc.invalidateQueries({ queryKey: chatKeys.conversations() });
		},
	});
};

export const useEditChatMessage = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			conversationID,
			messageID,
			input,
		}: {
			conversationID: string;
			messageID: string;
			input: EditChatMessageInput;
		}) => editChatMessage(conversationID, messageID, input),
		onSuccess: (_, variables) => {
			qc.invalidateQueries({ queryKey: chatKeys.messages(variables.conversationID) });
			qc.invalidateQueries({ queryKey: chatKeys.conversations() });
		},
	});
};

export const useSendChatMessage = () => {
	const qc = useQueryClient();
	return { mutateAsync: (request: ChatSendRequest) => enqueueChatMessage(qc, request) };
};

export const useAddChatMessageReaction = (conversationID: string, messageID: string) => {
	const qc = useQueryClient();
	const me = useMe();
	const queryKey = chatKeys.messages(conversationID);
	return useMutation({
		mutationFn: (emojiID: number) => addChatMessageReaction(conversationID, messageID, emojiID),
		onMutate: async (emojiID) => {
			await qc.cancelQueries({ queryKey });
			const previous = captureMessageReaction(qc, queryKey, messageID, emojiID);
			const emoji = findCachedEmoji(qc, emojiID);
			const user = me.data;
			let optimistic = false;
			if (user) {
				qc.setQueryData<InfiniteData<PagedResponse<ChatMessage>>>(queryKey, (old) =>
					updateChatMessageReactions(old, messageID, (reactions) => {
						// 聚合结果没有本人选择顺序；满额替换等待服务端权威结果。
						if (reactions.filter((reaction) => reaction.self).length >= 3) {
							return reactions;
						}
						optimistic = true;
						return addSelfReaction(
							reactions,
							emojiID,
							{ id: user.id, name: user.display_name || user.username },
							emoji,
						);
					}),
				);
			}
			return { previous, optimistic };
		},
		onError: (error, emojiID, context) => {
			const previous = context?.previous;
			if (previous && context?.optimistic) {
				qc.setQueryData<InfiniteData<PagedResponse<ChatMessage>>>(queryKey, (old) =>
					updateChatMessageReactions(old, messageID, (reactions) =>
						restoreReaction(reactions, emojiID, previous),
					),
				);
			}
			toast.error(error instanceof Error ? error.message : "回应没有成功");
		},
		onSettled: () => qc.invalidateQueries({ queryKey }),
	});
};

export const useRemoveChatMessageReaction = (conversationID: string, messageID: string) => {
	const qc = useQueryClient();
	const me = useMe();
	const queryKey = chatKeys.messages(conversationID);
	return useMutation({
		mutationFn: (emojiID: number) =>
			removeChatMessageReaction(conversationID, messageID, emojiID),
		onMutate: async (emojiID) => {
			await qc.cancelQueries({ queryKey });
			const previous = captureMessageReaction(qc, queryKey, messageID, emojiID);
			const user = me.data;
			if (user) {
				qc.setQueryData<InfiniteData<PagedResponse<ChatMessage>>>(queryKey, (old) =>
					updateChatMessageReactions(old, messageID, (reactions) =>
						removeSelfReaction(reactions, emojiID, user.id),
					),
				);
			}
			return { previous };
		},
		onError: (_error, emojiID, context) => {
			const previous = context?.previous;
			if (previous) {
				qc.setQueryData<InfiniteData<PagedResponse<ChatMessage>>>(queryKey, (old) =>
					updateChatMessageReactions(old, messageID, (reactions) =>
						restoreReaction(reactions, emojiID, previous),
					),
				);
			}
			toast.error("回应没有成功");
		},
		onSettled: () => qc.invalidateQueries({ queryKey }),
	});
};

export const useMarkChatRead = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, messageId }: { id: string; messageId?: string }) =>
			markChatRead(id, messageId),
		onSuccess: (_, variables) => {
			qc.invalidateQueries({ queryKey: chatKeys.conversation(variables.id) });
			qc.invalidateQueries({ queryKey: chatKeys.conversations() });
			qc.invalidateQueries({ queryKey: chatKeys.unreadCount() });
		},
	});
};

export const useChatPushConfig = () =>
	useQuery({ queryKey: chatKeys.pushConfig(), queryFn: () => fetchChatPushConfig() });

export const useSaveChatPushSubscription = () =>
	useMutation({ mutationFn: (input: PushSubscriptionInput) => saveChatPushSubscription(input) });

export const useDeleteChatPushSubscription = () =>
	useMutation({ mutationFn: (endpoint: string) => deleteChatPushSubscription(endpoint) });

function updateChatMessageReactions(
	data: InfiniteData<PagedResponse<ChatMessage>> | undefined,
	messageID: string,
	update: (reactions: AggregatedReaction[]) => AggregatedReaction[],
) {
	if (!data) {
		return data;
	}
	return {
		...data,
		pages: data.pages.map((page) => ({
			...page,
			data: page.data.map((message) =>
				message.id === messageID
					? { ...message, reactions: update(message.reactions ?? []) }
					: message,
			),
		})),
	};
}

function captureMessageReaction(
	qc: QueryClient,
	queryKey: readonly unknown[],
	messageId: string,
	emojiId: number,
) {
	const data = qc.getQueryData<InfiniteData<PagedResponse<ChatMessage>>>(queryKey);
	for (const page of data?.pages ?? []) {
		const message = page.data.find((entry) => entry.id === messageId);
		if (message) {
			return captureReaction(message.reactions, emojiId);
		}
	}
	return undefined;
}
