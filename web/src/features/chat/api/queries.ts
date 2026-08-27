import type { EmojiGroup } from "@entities/emoji/model/types";
import { emojiKeys } from "@features/emojis/api/keys";
import type { PagedResponse } from "@shared/api/types";
import {
	type InfiniteData,
	type QueryClient,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type {
	ChatMessage,
	ChatMessageReaction,
	CreateConversationInput,
	EditChatMessageInput,
	PushSubscriptionInput,
	SendMessageInput,
} from "../model/types";
import {
	addChatMessageReaction,
	createChatConversation,
	deleteChatMessage,
	deleteChatPushSubscription,
	editChatMessage,
	fetchChatContacts,
	fetchChatConversation,
	fetchChatConversations,
	fetchChatMembers,
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
	sendChatMessage,
	setChatMuted,
} from "./client";
import { chatKeys } from "./keys";

export const useChatConversations = () =>
	useQuery({ queryKey: chatKeys.conversations(), queryFn: () => fetchChatConversations() });

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

export const useChatMessages = (id: string | null) =>
	useInfiniteQuery({
		queryKey: id ? chatKeys.messages(id) : chatKeys.root,
		queryFn: ({ pageParam }) => fetchChatMessages(id as string, pageParam || undefined),
		initialPageParam: "",
		getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined,
		enabled: Boolean(id),
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
	return useMutation({
		mutationFn: ({
			id,
			input,
			idempotencyKey,
		}: {
			id: string;
			input: SendMessageInput;
			idempotencyKey: string;
		}) => sendChatMessage(id, input, idempotencyKey),
		onSuccess: (message, variables) => {
			qc.setQueryData<InfiniteData<PagedResponse<ChatMessage>>>(
				chatKeys.messages(variables.id),
				(old) => {
					if (!old) return old;
					return {
						...old,
						pages: old.pages.map((page, index) =>
							index === 0 ? { ...page, data: [message, ...page.data] } : page,
						),
					};
				},
			);
			qc.invalidateQueries({ queryKey: chatKeys.conversations() });
		},
	});
};

export const useAddChatMessageReaction = (conversationID: string, messageID: string) => {
	const qc = useQueryClient();
	const queryKey = chatKeys.messages(conversationID);
	return useMutation({
		mutationFn: (emojiID: number) => addChatMessageReaction(conversationID, messageID, emojiID),
		onMutate: async (emojiID) => {
			await qc.cancelQueries({ queryKey });
			const previous = qc.getQueryData<InfiniteData<PagedResponse<ChatMessage>>>(queryKey);
			const emoji = findEmojiById(qc, emojiID);
			if (emoji) {
				qc.setQueryData<InfiniteData<PagedResponse<ChatMessage>>>(queryKey, (old) =>
					updateChatMessageReactions(old, messageID, (reactions) => {
						const index = reactions.findIndex(
							(reaction) => reaction.emoji_id === emojiID,
						);
						if (index >= 0) {
							const reaction = reactions[index];
							if (reaction.self) return reactions;
							const next = [...reactions];
							next[index] = { ...reaction, count: reaction.count + 1, self: true };
							return next;
						}
						return [
							...reactions,
							{
								emoji_id: emojiID,
								emoji_name: emoji.name,
								emoji_url: emoji.url,
								gif_url: emoji.gif_url ?? "",
								count: 1,
								self: true,
							},
						];
					}),
				);
			}
			return { previous };
		},
		onError: (_error, _emojiID, context) => {
			if (context?.previous) qc.setQueryData(queryKey, context.previous);
		},
		onSettled: () => {
			qc.invalidateQueries({ queryKey });
		},
	});
};

export const useRemoveChatMessageReaction = (conversationID: string, messageID: string) => {
	const qc = useQueryClient();
	const queryKey = chatKeys.messages(conversationID);
	return useMutation({
		mutationFn: (emojiID: number) =>
			removeChatMessageReaction(conversationID, messageID, emojiID),
		onMutate: async (emojiID) => {
			await qc.cancelQueries({ queryKey });
			const previous = qc.getQueryData<InfiniteData<PagedResponse<ChatMessage>>>(queryKey);
			qc.setQueryData<InfiniteData<PagedResponse<ChatMessage>>>(queryKey, (old) =>
				updateChatMessageReactions(old, messageID, (reactions) => {
					const index = reactions.findIndex((reaction) => reaction.emoji_id === emojiID);
					if (index < 0 || !reactions[index].self) return reactions;
					if (reactions[index].count <= 1) {
						return reactions.filter((_, reactionIndex) => reactionIndex !== index);
					}
					const next = [...reactions];
					next[index] = {
						...reactions[index],
						count: reactions[index].count - 1,
						self: false,
					};
					return next;
				}),
			);
			return { previous };
		},
		onError: (_error, _emojiID, context) => {
			if (context?.previous) qc.setQueryData(queryKey, context.previous);
		},
		onSettled: () => {
			qc.invalidateQueries({ queryKey });
		},
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
	useQuery({ queryKey: chatKeys.pushConfig(), queryFn: fetchChatPushConfig });

export const useSaveChatPushSubscription = () =>
	useMutation({ mutationFn: (input: PushSubscriptionInput) => saveChatPushSubscription(input) });

export const useDeleteChatPushSubscription = () =>
	useMutation({ mutationFn: (endpoint: string) => deleteChatPushSubscription(endpoint) });

function findEmojiById(qc: QueryClient, emojiID: number) {
	const groups = qc.getQueryData<EmojiGroup[]>(emojiKeys.publicGroupList());
	for (const group of groups ?? []) {
		const emoji = group.emojis.find((item) => item.id === emojiID);
		if (emoji) return emoji;
	}
	return null;
}

function updateChatMessageReactions(
	data: InfiniteData<PagedResponse<ChatMessage>> | undefined,
	messageID: string,
	update: (reactions: ChatMessageReaction[]) => ChatMessageReaction[],
) {
	if (!data) return data;
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
