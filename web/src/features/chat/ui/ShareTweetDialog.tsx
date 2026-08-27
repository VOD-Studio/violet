/**
 * ShareTweetDialog - 分享推文到聊天的会话选择器
 *
 * 常驻 __root，由 `useShareTweetStore.tweet` 驱动显隐（TweetCard 调 open() 触发，
 * 见 CONTEXT.md「分享到聊天」词条）。列出现有会话（按名称过滤）与可发起私聊的
 * 联系人；选定目标后 commit() 落定待发分享并跳转 /chat，聊天输入框读 pending
 * 展示分享 banner、可选加配文后发送。
 */
import { useMe } from "@features/auth/api/queries";
import {
	useChatContacts,
	useChatConversations,
	useCreateChatConversation,
} from "@features/chat/api/queries";
import type { ChatUser } from "@features/chat/model/types";
import { useShareTweetStore } from "@shared/api/share-tweet-store";
import { Modal } from "@shared/ui/modal";
import { useNavigate } from "@tanstack/react-router";
import { LoaderCircle, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { conversationLabel, conversationTargetUser } from "../lib/conversation";
import { ChatAvatar } from "./ChatAvatar";
import { ChatContactSkeleton } from "./ChatContactSkeleton";

export function ShareTweetDialog() {
	const tweet = useShareTweetStore((s) => s.tweet);
	const close = useShareTweetStore((s) => s.close);
	const commit = useShareTweetStore((s) => s.commit);
	const navigate = useNavigate();
	const { data: me } = useMe();
	const [search, setSearch] = useState("");
	const [creatingUserID, setCreatingUserID] = useState<string | null>(null);
	const deferredSearch = useDeferredValue(search.trim());

	const { data: conversationsPage, isLoading: conversationsLoading } = useChatConversations();
	const contactsQuery = useChatContacts(deferredSearch, deferredSearch.length > 0);
	const createConversation = useCreateChatConversation();

	const conversations = conversationsPage?.data ?? [];
	const contacts = contactsQuery.data?.pages.flatMap((page) => page.data) ?? [];
	const query = deferredSearch.toLowerCase();
	const filteredConversations = query
		? conversations.filter((c) => conversationLabel(c, me?.id).toLowerCase().includes(query))
		: conversations;
	// 已有私聊对象排除出联系人搜索结果，避免同一个人出现两次入口。
	const directPartnerIDs = new Set(
		conversations
			.filter((c) => c.kind === "direct")
			.map((c) => conversationTargetUser(c, me?.id).id),
	);
	const newContacts = contacts.filter((user) => !directPartnerIDs.has(user.id));

	const goTo = (conversationId: string) => {
		commit(conversationId);
		close();
		setSearch("");
		navigate({ to: "/chat" });
	};

	const handlePickUser = async (user: ChatUser) => {
		setCreatingUserID(user.id);
		try {
			const conversation = await createConversation.mutateAsync({
				kind: "direct",
				participant_ids: [user.id],
			});
			goTo(conversation.id);
		} catch {
			toast.error("无法创建会话", { description: "请稍后重试" });
		} finally {
			setCreatingUserID(null);
		}
	};

	return (
		<Modal
			open={!!tweet}
			onOpenChange={(open) => !open && close()}
			title="分享推文到聊天"
			size="sm"
		>
			<div className="space-y-3">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<input
						className="w-full rounded-lg border border-input/70 bg-secondary/40 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-neon-cyan/50"
						onChange={(e) => setSearch(e.target.value)}
						placeholder="搜索会话或用户"
						value={search}
					/>
				</div>
				<div className="max-h-80 space-y-1 overflow-y-auto">
					{conversationsLoading ? (
						<ChatContactSkeleton />
					) : (
						filteredConversations.map((conversation) => (
							<button
								className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-secondary/60"
								key={conversation.id}
								onClick={() => goTo(conversation.id)}
								type="button"
							>
								<ChatAvatar
									className="size-8"
									user={conversationTargetUser(conversation, me?.id)}
								/>
								<span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
									{conversationLabel(conversation, me?.id)}
								</span>
							</button>
						))
					)}
					{deferredSearch && newContacts.length > 0 && (
						<>
							<p className="px-2 pt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
								新建私聊
							</p>
							{newContacts.map((user) => (
								<button
									className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-secondary/60 disabled:opacity-50"
									disabled={creatingUserID === user.id}
									key={user.id}
									onClick={() => void handlePickUser(user)}
									type="button"
								>
									<ChatAvatar className="size-8" user={user} />
									<span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
										{user.display_name || user.username}
									</span>
									{creatingUserID === user.id && (
										<LoaderCircle className="size-4 shrink-0 animate-spin text-muted-foreground" />
									)}
								</button>
							))}
						</>
					)}
					{!conversationsLoading &&
						filteredConversations.length === 0 &&
						!deferredSearch && (
							<p className="px-2 py-6 text-center text-sm text-muted-foreground">
								暂无会话，搜索用户开始私聊
							</p>
						)}
				</div>
			</div>
		</Modal>
	);
}
