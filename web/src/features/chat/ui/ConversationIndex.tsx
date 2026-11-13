/**
 * 会话索引侧栏：标题、搜索、会话列表与搜索结果（含发起私聊）。
 */

import {
	Avatar,
	Button,
	Empty,
	Input,
	iconProps,
	ListHighlight,
	ListHighlightItem,
	Segmented,
} from "@violet/ui";

import { cn } from "cn";
import { MessageCircle, Plus, Search, Users } from "lucide-react";
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
import { ChatAppearanceButton } from "./appearance/ChatAppearanceButton";
import { ChatAppearanceProvider } from "./appearance/ChatAppearanceProvider";
import { ChatAvatar } from "./ChatAvatar";
import { ChatContactSkeleton } from "./ChatContactSkeleton";
import { NewConversationForm } from "./NewConversationForm";

interface ConversationIndexProps {
	conversations: ChatConversation[];
	currentUserID: string;
	loading: boolean;
	selectedID: string | null;
	search: string;
	appearanceOpen: boolean;
	onOpenAppearance: () => void;
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
	appearanceOpen,
	onOpenAppearance,
	search,
	showNew,
	onSearch,
	onToggleNew,
	onSelect,
	onCreated,
}: ConversationIndexProps) {
	const [filter, setFilter] = useState<"all" | "room" | "direct">("all");
	const filteredConversations = conversations.filter(
		(conversation) => filter === "all" || conversation.kind === filter,
	);
	const deferredSearch = useDeferredValue(search.trim());
	const contactsEnabled = Boolean(deferredSearch);

	return (
		<div className="flex h-full min-h-0 min-w-0 flex-col">
			<header className="shrink-0 px-4 pb-1.5 pt-3.5">
				<div className="flex items-center justify-between gap-2 pb-3">
					<h1 className="mr-auto text-xl font-semibold text-foreground">聊天</h1>
					<ChatAppearanceButton active={appearanceOpen} onClick={onOpenAppearance} />
					<Button
						iconOnly
						aria-label="新建会话"
						className={cn(
							"size-9 rounded-full text-muted-foreground transition-colors",
							showNew
								? "bg-secondary text-foreground"
								: "hover:bg-secondary hover:text-foreground",
						)}
						onClick={onToggleNew}
						size="md"
						variant="ghost"
					>
						<Plus className={cn("size-5", showNew && "rotate-45")} />
					</Button>
				</div>
				<div className="pb-1">
					<Input
						aria-label="搜索会话、用户或群聊"
						type="search"
						clearable
						clearLabel="清空搜索"
						leading={<Search />}
						onChange={(event) => onSearch(event.target.value)}
						placeholder="搜索"
						value={search}
					/>
				</div>
				<div className="pt-2">
					<Segmented
						aria-label="会话类型"
						block
						value={filter}
						onValueChange={setFilter}
						segments={[
							{ value: "all", label: "全部" },
							{ value: "room", label: "群聊" },
							{ value: "direct", label: "私信" },
						]}
					/>
				</div>
			</header>
			{showNew && <NewConversationForm onCreated={onCreated} onClose={onToggleNew} />}

			<div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-2.5 pb-2.5 pt-1">
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
				) : loading ? (
					<ConversationSkeleton />
				) : conversations.length === 0 ? (
					<ConversationEmpty onCreate={onToggleNew} />
				) : filteredConversations.length === 0 ? (
					<Empty
						variant="plain"
						title={filter === "room" ? "还没有群聊" : "还没有私信"}
						description="切换到全部查看已有会话，或新建会话。"
						action={
							<Button variant="outline" size="sm" onClick={onToggleNew}>
								新建会话
							</Button>
						}
					/>
				) : (
					<ListHighlight>
						<div className="space-y-0.5">
							{filteredConversations.map((conversation) => (
								<ConversationRow
									active={conversation.id === selectedID}
									conversation={conversation}
									currentUserID={currentUserID}
									key={conversation.id}
									onClick={() => onSelect(conversation.id)}
								/>
							))}
						</div>
					</ListHighlight>
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
		<ChatAppearanceProvider
			currentUserID={currentUserID}
			userIDs={contacts.map((user) => user.id)}
		>
			<div className="space-y-4">
				<SearchResultSection label="已有会话" count={conversations.length}>
					{conversations.length > 0 ? (
						<ListHighlight>
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
						</ListHighlight>
					) : (
						<Empty variant="compact" title="没有匹配的会话" />
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
										loading={busyID === user.id}
										onClick={() => void startPrivateChat(user)}
										size="sm"
										className="h-8 shrink-0 px-2.5 text-xs"
										leftIcon={<MessageCircle {...iconProps(14)} />}
									>
										<span className="sr-only sm:not-sr-only sm:ml-1">私聊</span>
									</Button>
								</div>
							))}
						</div>
					) : (
						<Empty variant="compact" title="没有匹配的用户" />
					)}
				</SearchResultSection>
			</div>
		</ChatAppearanceProvider>
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
	const label = conversationLabel(conversation, currentUserID);

	return (
		<ListHighlightItem active={active}>
			<button
				data-conversation-id={conversation.id}
				aria-current={active ? "true" : undefined}
				aria-label={`${label}${conversation.unread_count > 0 ? `，${conversation.unread_count} 条未读消息` : ""}`}
				className={cn(
					"group relative flex w-full min-w-0 items-center gap-3 rounded-xl p-2.5 text-left",
					active
						? "font-medium text-foreground"
						: "text-foreground/90 hover:text-foreground",
				)}
				onClick={onClick}
				type="button"
			>
				<div className="shrink-0">
					{conversation.kind === "room" ? (
						<Avatar
							size={40}
							shape="square"
							icon={<Users {...iconProps(20, "size-5")} />}
							alt=""
						/>
					) : (
						<ChatAvatar user={avatarUser} className="size-10" linked={false} />
					)}
				</div>
				<span className="min-w-0 flex-1">
					<span className="flex items-center justify-between gap-2">
						<strong className="min-w-0 truncate text-[15px] font-semibold text-foreground">
							{label}
						</strong>
						<time className="shrink-0 text-xs leading-5 text-muted-foreground">
							{lastTime ? formatRelativeTime(lastTime) : ""}
						</time>
					</span>
					<span className="mt-0.5 flex items-center justify-between gap-2">
						<span className="truncate text-[13px] leading-5 text-muted-foreground">
							{conversation.last_message ? (
								<>
									{conversation.kind === "room" &&
										conversation.last_message.type !== "system" &&
										`${conversation.last_message.sender.id === currentUserID ? "你" : conversation.last_message.sender.display_name}：`}
									{messagePreview(conversation.last_message)}
								</>
							) : (
								"还没有消息，打个招呼吧"
							)}
						</span>
						{conversation.unread_count > 0 && (
							<span
								aria-hidden="true"
								className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium leading-none text-primary-foreground tabular-nums"
							>
								{conversation.unread_count > 99 ? "99+" : conversation.unread_count}
							</span>
						)}
					</span>
				</span>
			</button>
		</ListHighlightItem>
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
		<Empty
			variant="plain"
			title="还没有会话"
			description="发起一次私聊或创建群聊即可建立连接。"
			action={
				<Button onClick={onCreate} size="sm" variant="outline">
					<Plus {...iconProps(14)} />
					新建会话
				</Button>
			}
		/>
	);
}
