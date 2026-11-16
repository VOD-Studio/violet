import { Avatar, Button } from "@violet/ui";
import { cn } from "cn";
import { ArrowLeft, EllipsisVertical, Search, UsersRound, X } from "lucide-react";
import { type ReactNode, type Ref, useEffect, useRef } from "react";
import { conversationLabel, conversationTargetUser } from "../lib/conversation";
import type { ChatConversation, ChatMember } from "../model/types";
import { ChatAvatar } from "./ChatAvatar";
import { ConversationStatusLine } from "./ConversationStatusLine";

interface ConversationHeaderProps {
	conversation: ChatConversation;
	currentUserID: string;
	members: ChatMember[];
	headingRef: Ref<HTMLHeadingElement>;
	onBack: () => void;
	showDetails: boolean;
	onToggleDetails: () => void;
	searchOpen: boolean;
	searchContent: ReactNode;
	onToggleSearch: () => void;
}

/** 会话标题与在场角色共享一个头部，详情只覆盖正文右侧。 */
export function ConversationHeader({
	conversation,
	currentUserID,
	members,
	headingRef,
	onBack,
	showDetails,
	onToggleDetails,
	searchOpen,
	searchContent,
	onToggleSearch,
}: ConversationHeaderProps) {
	const details = useRef<HTMLButtonElement>(null);
	const wasOpen = useRef(showDetails);
	const searchButton = useRef<HTMLButtonElement>(null);
	const wasSearching = useRef(searchOpen);
	useEffect(() => {
		if (wasOpen.current && !showDetails) {
			details.current?.focus({ preventScroll: true });
		}
		wasOpen.current = showDetails;
	}, [showDetails]);
	useEffect(() => {
		if (wasSearching.current && !searchOpen) {
			searchButton.current?.focus({ preventScroll: true });
		}
		wasSearching.current = searchOpen;
	}, [searchOpen]);
	return (
		<header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
			<Button
				iconOnly
				aria-label="返回会话列表"
				className="shrink-0 md:hidden"
				onClick={onBack}
				size="md"
				variant="ghost"
			>
				<ArrowLeft className="size-5" />
			</Button>
			<div className="relative flex min-w-0 flex-1 items-center">
				<div
					aria-hidden={searchOpen}
					className={cn(
						"flex min-w-0 flex-1 items-center gap-3",
						searchOpen && "invisible",
					)}
					inert={searchOpen}
				>
					<div className="shrink-0">
						{conversation.kind === "room" ? (
							<Avatar size={40} icon={<UsersRound className="size-5" />} alt="" />
						) : (
							<ChatAvatar
								user={conversationTargetUser(conversation, currentUserID)}
								className="size-10"
							/>
						)}
					</div>
					<div className="min-w-0 flex-1">
						<h2
							ref={headingRef}
							tabIndex={-1}
							className="truncate text-base font-semibold leading-snug text-foreground outline-none"
						>
							{conversationLabel(conversation, currentUserID)}
						</h2>
						<ConversationStatusLine
							conversation={conversation}
							currentUserID={currentUserID}
							members={members}
						/>
					</div>
				</div>
				<div
					aria-hidden={!searchOpen}
					className={cn(
						"absolute inset-0 flex items-center",
						!searchOpen && "invisible pointer-events-none",
					)}
					inert={!searchOpen}
				>
					{searchContent}
				</div>
			</div>
			<Button
				ref={searchButton}
				iconOnly
				aria-label={searchOpen ? "关闭消息搜索" : "搜索消息"}
				aria-expanded={searchOpen}
				className="shrink-0"
				onClick={onToggleSearch}
				size="md"
				variant="ghost"
			>
				{searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
			</Button>
			<Button
				ref={details}
				iconOnly
				aria-label="打开会话详情"
				aria-expanded={showDetails}
				className="shrink-0"
				onClick={onToggleDetails}
				size="md"
				variant="ghost"
			>
				<EllipsisVertical className="size-5" />
			</Button>
		</header>
	);
}
