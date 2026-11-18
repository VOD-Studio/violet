/**
 * 聊天工作区：会话索引侧栏 + 会话面板的顶层布局与选中态编排。
 */

import { useMe } from "@features/auth/api/queries";
import { Button, Empty, Spinner } from "@violet/ui";
import { cn } from "cn";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useChatConversations } from "../api/queries";
import { ChatDraftProvider } from "../hooks/use-chat-draft";
import { useChatSelection } from "../hooks/useChatSelection";
import { conversationAppearanceUserIDs } from "../lib/appearance-users";
import { conversationLabel } from "../lib/conversation";
import { ChatAppearanceProvider } from "./appearance/ChatAppearanceProvider";
import { ChatAppearanceWorkspace } from "./appearance/ChatAppearanceWorkspace";
import { ConversationIndex } from "./ConversationIndex";
import { ConversationPanel } from "./ConversationPanel";
import { EmptyConversation } from "./chat-states";

export function ChatWorkspace() {
	const { data: me, isError: identityFailed, refetch: reloadIdentity } = useMe();
	const {
		data: conversationsPage,
		isLoading: conversationsLoading,
		isError: conversationsFailed,
		refetch: reloadConversations,
	} = useChatConversations();
	const conversations = conversationsPage?.data ?? [];
	const { selectedID, selectConversation, clearSelection } = useChatSelection();
	const [search, setSearch] = useState("");
	const [showDetails, setShowDetails] = useState(false);
	const [showNew, setShowNew] = useState(false);
	const [appearanceOpen, setAppearanceOpen] = useState(false);
	const indexRef = useRef<HTMLElement>(null);
	const previousSelection = useRef(selectedID);

	useLayoutEffect(() => {
		const previous = previousSelection.current;
		previousSelection.current = selectedID;
		setShowDetails(false);
		if (selectedID || !previous) {
			return;
		}
		const row = Array.from(
			indexRef.current?.querySelectorAll<HTMLElement>("[data-conversation-id]") ?? [],
		).find((element) => element.dataset.conversationId === previous);
		(row ?? indexRef.current?.querySelector<HTMLInputElement>('input[type="search"]'))?.focus({
			preventScroll: true,
		});
	}, [selectedID]);

	const selected = conversations.find((conversation) => conversation.id === selectedID) ?? null;
	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) {
			return conversations;
		}
		return conversations.filter((conversation) =>
			conversationLabel(conversation, me?.id).toLowerCase().includes(query),
		);
	}, [conversations, me?.id, search]);

	useEffect(() => {
		if (selectedID && !selected && conversationsPage) {
			clearSelection(true);
		}
	}, [clearSelection, conversationsPage, selected, selectedID]);

	if (!me) {
		return identityFailed ? (
			<Empty
				variant="plain"
				title="无法加载当前用户"
				action={<Button onClick={() => void reloadIdentity()}>重新加载</Button>}
			/>
		) : (
			<div role="status" className="flex flex-1 items-center justify-center gap-2">
				<Spinner size={20} />
				<span className="text-sm text-muted-foreground">正在加载聊天…</span>
			</div>
		);
	}

	return (
		<ChatDraftProvider key={me.id}>
			<ChatAppearanceProvider
				currentUserID={me.id}
				userIDs={conversationAppearanceUserIDs(conversations)}
			>
				<div className="isolate mx-auto flex min-h-0 w-full max-w-360 flex-1 overflow-hidden bg-card md:my-4 md:w-[calc(100%-3rem)] md:rounded-2xl md:border md:border-border md:shadow-soft">
					<aside
						ref={indexRef}
						aria-label="会话列表"
						className={cn(
							"relative z-10 flex min-h-0 w-full shrink-0 flex-col bg-card md:flex md:w-80 xl:w-88",
							selectedID &&
								(!conversationsFailed || conversationsPage) &&
								"hidden md:flex",
						)}
					>
						{conversationsFailed && !conversationsPage ? (
							<Empty
								variant="plain"
								title="会话加载失败"
								description="重新加载后继续聊天，未发送的内容仍保留。"
								action={
									<Button onClick={() => void reloadConversations()}>
										重新加载
									</Button>
								}
							/>
						) : (
							<ConversationIndex
								conversations={filtered}
								currentUserID={me?.id ?? ""}
								loading={conversationsLoading}
								selectedID={selectedID}
								search={search}
								showNew={showNew}
								appearanceOpen={appearanceOpen}
								onOpenAppearance={() => {
									setAppearanceOpen((open) => !open);
									setShowNew(false);
								}}
								onSearch={setSearch}
								onToggleNew={() => {
									setShowNew((value) => !value);
									setAppearanceOpen(false);
								}}
								onSelect={(id) => {
									selectConversation(id);
									setAppearanceOpen(false);
								}}
								onCreated={(id) => {
									selectConversation(id);
									setShowNew(false);
									setAppearanceOpen(false);
								}}
							/>
						)}
					</aside>

					<section
						aria-label="聊天区"
						className={cn(
							"relative flex min-h-0 min-w-0 flex-1 flex-col",
							(!selectedID || (conversationsFailed && !selected)) && "hidden md:flex",
						)}
					>
						<div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
							{selected ? (
								<ConversationPanel
									key={selected.id}
									active={!appearanceOpen && !showNew}
									conversation={selected}
									currentUserID={me?.id ?? ""}
									onBack={clearSelection}
									showDetails={showDetails}
									onToggleDetails={() => setShowDetails((value) => !value)}
								/>
							) : (
								<EmptyConversation onCreate={() => setShowNew(true)} />
							)}
						</div>
					</section>
					<ChatAppearanceWorkspace
						open={appearanceOpen}
						user={{
							id: me.id,
							username: me.username,
							display_name: me.display_name ?? "",
							avatar_url: me.avatar_url ?? "",
						}}
						onClose={() => setAppearanceOpen(false)}
					/>
				</div>
			</ChatAppearanceProvider>
		</ChatDraftProvider>
	);
}
