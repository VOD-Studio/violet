/**
 * 聊天工作区：会话索引侧栏 + 会话面板的顶层布局与选中态编排。
 */
import { useMe } from "@features/auth/api/queries";
import { useShareTweetStore } from "@shared/api/share-tweet-store";
import { cn } from "@shared/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useChatConversations } from "../api/queries";
import { useChatSelection } from "../hooks/useChatSelection";
import { conversationLabel } from "../lib/conversation";
import { ConversationIndex } from "./ConversationIndex";
import { ConversationPanel } from "./ConversationPanel";
import { EmptyConversation } from "./chat-states";

export function ChatWorkspace() {
	const { data: me } = useMe();
	const { data: conversationsPage, isLoading: conversationsLoading } = useChatConversations();
	const conversations = conversationsPage?.data ?? [];
	const { selectedID, selectConversation, clearSelection } = useChatSelection();
	const pendingShare = useShareTweetStore((s) => s.pending);
	const [search, setSearch] = useState("");
	const [showDetails, setShowDetails] = useState(false);
	const [showNew, setShowNew] = useState(false);

	const selected = conversations.find((conversation) => conversation.id === selectedID) ?? null;
	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		if (!query) return conversations;
		return conversations.filter((conversation) =>
			conversationLabel(conversation, me?.id).toLowerCase().includes(query),
		);
	}, [conversations, me?.id, search]);

	useEffect(() => {
		if (selectedID && !selected && !conversationsLoading) clearSelection(true);
	}, [clearSelection, conversationsLoading, selected, selectedID]);

	// 从 ShareTweetDialog 落定的待发分享：自动切到目标会话，输入框读同一 store 的 pending 展示 banner。
	useEffect(() => {
		if (pendingShare) selectConversation(pendingShare.conversationId);
	}, [pendingShare, selectConversation]);

	return (
		<div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
			<aside
				className={cn(
					"relative flex w-full shrink-0 flex-col border-r border-border bg-card/70 backdrop-blur-xl md:flex md:w-80 lg:w-84",
					selectedID && "hidden md:flex",
				)}
			>
				<ConversationIndex
					conversations={filtered}
					currentUserID={me?.id ?? ""}
					loading={conversationsLoading}
					selectedID={selectedID}
					search={search}
					showNew={showNew}
					onSearch={setSearch}
					onToggleNew={() => setShowNew((value) => !value)}
					onSelect={selectConversation}
					onCreated={(id) => {
						selectConversation(id);
						setShowNew(false);
					}}
				/>
			</aside>

			<main
				className={cn(
					"relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background/60",
					!selectedID && "hidden md:flex",
				)}
			>
				{selected ? (
					<ConversationPanel
						conversation={selected}
						currentUserID={me?.id ?? ""}
						onBack={clearSelection}
						pendingShare={
							pendingShare?.conversationId === selected.id ? pendingShare : null
						}
						showDetails={showDetails}
						onToggleDetails={() => setShowDetails((value) => !value)}
					/>
				) : (
					<EmptyConversation onCreate={() => setShowNew(true)} />
				)}
			</main>
		</div>
	);
}
