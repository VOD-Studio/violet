/**
 * 会话索引侧栏：标题、搜索、会话列表与搜索结果（含发起私聊）。
 */

import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { LoaderCircle, MessageCircle, Plus, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { useChatContacts, useCreateChatConversation } from "../api/queries";
import {
	conversationLabel,
	conversationTargetUser,
	formatRelativeTime,
	messagePreview,
} from "../lib/conversation";
import type { ChatConversation, ChatUser } from "../model/types";
import { ChatAvatar } from "./ChatAvatar";
import { ChatContactSkeleton } from "./ChatContactSkeleton";
import { NewConversationForm } from "./NewConversationForm";

interface ConversationIndexProps {
	conversations: ChatConversation[];
	currentUserID: string;
	loading: boolean;
	selectedID: string | null;
	search: string;
	showNew: boolean;
	onSearch: (value: string) => void;
	onToggleNew: () => void;
	onSelect: (id: string) => void;
	onCreated: (id: string) => void;
}

export function ConversationIndex({
	conversations,
	currentUserID,
	loading,
	selectedID,
	search,
	showNew,
	onSearch,
	onToggleNew,
	onSelect,
	onCreated,
}: ConversationIndexProps) {
	const deferredSearch = useDeferredValue(search.trim());
	const contactsEnabled = Boolean(deferredSearch);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<header className="shrink-0 px-3 pb-2 pt-4 md:px-4">
				<div className="flex h-11 items-center justify-between gap-3 px-1">
					<h1 className="text-[1.35rem] font-semibold text-foreground">聊天</h1>
					<Button
						aria-label="新建会话"
						className={cn(
							"size-9 rounded-full text-muted-foreground transition-colors",
							showNew
								? "bg-secondary text-foreground"
								: "hover:bg-secondary hover:text-foreground",
						)}
						onClick={onToggleNew}
						size="icon"
						variant="ghost"
					>
						<Plus
							className={cn("size-5 transition-transform", showNew && "rotate-45")}
						/>
					</Button>
				</div>
				<div className="px-1 pb-1">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<input
							aria-label="搜索会话、用户或群聊"
							className="h-10 w-full rounded-full border-none bg-secondary pl-10 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
							onChange={(event) => onSearch(event.target.value)}
							placeholder="搜索"
							value={search}
						/>
						{search && (
							<button
								aria-label="清空搜索"
								className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
								onClick={() => onSearch("")}
								type="button"
							>
								<X className="size-4" />
							</button>
						)}
					</div>
				</div>
			</header>

			<AnimatePresence>
				{showNew && <NewConversationForm onCreated={onCreated} onClose={onToggleNew} />}
			</AnimatePresence>

			<div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5">
				{search.trim() ? (
					<SearchResults
						contactsEnabled={contactsEnabled}
						conversations={conversations}
						deferredSearch={deferredSearch}
						currentUserID={currentUserID}
						onCreated={onCreated}
						onSelect={onSelect}
						selectedID={selectedID}
					/>
				) : (
					<>
						<div className="mb-2 flex items-center justify-between px-2 text-xs text-muted-foreground">
							<span>会话</span>
							<span className="tabular-nums">{conversations.length}</span>
						</div>
						{loading ? (
							<ConversationSkeleton />
						) : conversations.length === 0 ? (
							<ConversationEmpty onCreate={onToggleNew} />
						) : (
							<div className="space-y-1">
								{conversations.map((conversation) => (
									<ConversationRow
										active={conversation.id === selectedID}
										conversation={conversation}
										currentUserID={currentUserID}
										key={conversation.id}
										onClick={() => onSelect(conversation.id)}
									/>
								))}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}

interface SearchResultsProps {
	conversations: ChatConversation[];
	deferredSearch: string;
	contactsEnabled: boolean;
	currentUserID: string;
	selectedID: string | null;
	onCreated: (id: string) => void;
	onSelect: (id: string) => void;
}

function SearchResults({
	conversations,
	deferredSearch,
	contactsEnabled,
	currentUserID,
	selectedID,
	onCreated,
	onSelect,
}: SearchResultsProps) {
	const create = useCreateChatConversation();
	const [busyID, setBusyID] = useState<string | null>(null);
	const contactsQuery = useChatContacts(deferredSearch, contactsEnabled);
	const contacts = contactsQuery.data?.pages.flatMap((page) => page.data) ?? [];

	const startPrivateChat = async (user: ChatUser) => {
		setBusyID(user.id);
		try {
			const conversation = await create.mutateAsync({
				kind: "direct",
				participant_ids: [user.id],
			});
			onCreated(conversation.id);
		} catch {
			toast.error("无法发起私聊", { description: "请稍后重试" });
		} finally {
			setBusyID(null);
		}
	};

	return (
		<div className="space-y-4">
			<SearchResultSection label="已有会话" count={conversations.length}>
				{conversations.length > 0 ? (
					<div className="space-y-1">
						{conversations.map((conversation) => (
							<ConversationRow
								active={conversation.id === selectedID}
								conversation={conversation}
								currentUserID={currentUserID}
								key={conversation.id}
								onClick={() => onSelect(conversation.id)}
							/>
						))}
					</div>
				) : (
					<p className="px-2.5 py-2 text-xs text-muted-foreground/70">没有匹配的会话</p>
				)}
			</SearchResultSection>
			<SearchResultSection label="用户" count={contacts.length}>
				{contactsQuery.isLoading ? (
					<ChatContactSkeleton />
				) : contacts.length > 0 ? (
					<div className="space-y-1">
						{contacts.map((user) => (
							<div
								className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-all duration-150 hover:border-edge-hairline hover:bg-secondary/40"
								key={user.id}
							>
								<ChatAvatar user={user} className="size-9 shrink-0" />
								<div className="min-w-0 flex-1">
									<p className="truncate text-xs font-semibold text-foreground">
										{user.display_name}
									</p>
									<p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
										@{user.username}
									</p>
								</div>
								<Button
									aria-label={`发起与${user.display_name}的私聊`}
									disabled={busyID !== null}
									onClick={() => void startPrivateChat(user)}
									size="sm"
									className="h-8 shrink-0 px-2.5 text-xs shadow-xs"
								>
									{busyID === user.id ? (
										<LoaderCircle className="size-3.5 animate-spin" />
									) : (
										<MessageCircle className="size-3.5" />
									)}
									<span className="sr-only sm:not-sr-only sm:ml-1">私聊</span>
								</Button>
							</div>
						))}
					</div>
				) : (
					<p className="px-2.5 py-2 text-xs text-muted-foreground/70">没有匹配的用户</p>
				)}
			</SearchResultSection>
		</div>
	);
}

function SearchResultSection({
	label,
	count,
	children,
}: {
	label: string;
	count: number;
	children: ReactNode;
}) {
	return (
		<section>
			<div className="mb-2 flex items-center justify-between px-2 text-xs text-muted-foreground">
				<span>{label}</span>
				<span className="tabular-nums">{count}</span>
			</div>
			{children}
		</section>
	);
}

export interface ConversationRowProps {
	/** 会话资源。 */
	conversation: ChatConversation;
	/** 当前用户 ID，用于私聊标题排除自己。 */
	currentUserID: string;
	/** 是否为当前选中项。 */
	active: boolean;
	/** 选择会话。 */
	onClick: () => void;
}

export function ConversationRow({
	conversation,
	currentUserID,
	active,
	onClick,
}: ConversationRowProps) {
	const avatarUser = conversationTargetUser(conversation, currentUserID);
	const lastTime = conversation.last_message?.created_at ?? conversation.updated_at;

	return (
		<button
			className={cn(
				"group relative flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left outline-none md:px-3",
				active ? "text-foreground" : "text-foreground/90 hover:text-foreground",
			)}
			onClick={onClick}
			type="button"
		>
			{/* 选中态：滑动高亮卡片（layoutId 跨行平滑过渡） */}
			{active && (
				<motion.div
					layoutId="active-chat-row-highlight"
					className="absolute inset-0 rounded-2xl bg-accent"
					transition={{ type: "spring", stiffness: 450, damping: 35 }}
				/>
			)}

			<div className="relative z-10 shrink-0">
				<ChatAvatar user={avatarUser} className="size-12" />
			</div>

			<span className="relative z-10 min-w-0 flex-1 border-b border-border/60 pb-2 group-last:border-0">
				<span className="flex items-center justify-between gap-2 pt-0.5">
					<strong className="truncate text-[0.95rem] font-semibold text-foreground">
						{conversationLabel(conversation, currentUserID)}
					</strong>
					<time className="shrink-0 text-xs leading-5 text-muted-foreground">
						{lastTime ? formatRelativeTime(lastTime) : ""}
					</time>
				</span>
				<span className="mt-0.5 flex items-center justify-between gap-2">
					<span className="truncate text-sm leading-5 text-muted-foreground">
						{conversation.last_message
							? messagePreview(conversation.last_message)
							: "还没有消息，打个招呼吧"}
					</span>
					{conversation.unread_count > 0 && (
						<span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium leading-none text-primary-foreground tabular-nums">
							{conversation.unread_count > 99 ? "99+" : conversation.unread_count}
						</span>
					)}
				</span>
			</span>
		</button>
	);
}

export function ConversationSkeleton() {
	return (
		<div className="space-y-2 px-1 py-1">
			{Array.from({ length: 5 }, (_, index) => (
				<div className="flex items-center gap-3 p-2" key={index}>
					<div className="size-9 animate-pulse rounded-full bg-secondary/80" />
					<div className="flex-1 space-y-1.5">
						<div className="h-3 w-2/3 animate-pulse rounded bg-secondary/80" />
						<div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary/60" />
					</div>
				</div>
			))}
		</div>
	);
}

export function ConversationEmpty({ onCreate }: { onCreate: () => void }) {
	return (
		<div className="px-4 py-10 text-center">
			<MessageCircle className="mx-auto size-5 text-muted-foreground" />
			<p className="mt-2.5 text-xs font-medium">还没有会话</p>
			<p className="mt-0.5 text-xs text-muted-foreground">发起一次私聊即可建立连接。</p>
			<Button
				className="mt-3.5 h-8 px-3 text-xs"
				onClick={onCreate}
				size="sm"
				variant="outline"
			>
				<Plus className="mr-1 size-3.5" />
				新建会话
			</Button>
		</div>
	);
}
