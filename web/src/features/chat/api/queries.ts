import type { PagedResponse } from "@shared/api/types";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	ChatMessage,
	CreateConversationInput,
	PushSubscriptionInput,
	SendMessageInput,
} from "../model/types";
import {
	createChatConversation,
	deleteChatMessage,
	deleteChatPushSubscription,
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
	useQuery({
		queryKey: id ? chatKeys.messages(id) : chatKeys.root,
		queryFn: () => fetchChatMessages(id as string),
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
		onSuccess: (_, variables) =>
			qc.invalidateQueries({ queryKey: chatKeys.conversation(variables.id) }),
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
		onSuccess: (_, variables) =>
			qc.invalidateQueries({ queryKey: chatKeys.conversation(variables.id) }),
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
			qc.setQueryData<PagedResponse<ChatMessage>>(chatKeys.messages(variables.id), (old) =>
				old ? { ...old, data: [message, ...old.data] } : old,
			);
			qc.invalidateQueries({ queryKey: chatKeys.conversations() });
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
