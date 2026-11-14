import { Avatar, AvatarGroup, Button } from "@violet/ui";
import { ArrowLeft, Hash, PanelRight, Search } from "lucide-react";
import { type Ref, useEffect, useRef } from "react";
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
	onToggleSearch,
}: ConversationHeaderProps) {
	const roles = members.filter((member) => member.user.is_bot);
	const details = useRef<HTMLButtonElement>(null);
	const wasOpen = useRef(showDetails);
	useEffect(() => {
		if (wasOpen.current && !showDetails) {
			details.current?.focus({ preventScroll: true });
		}
		wasOpen.current = showDetails;
	}, [showDetails]);
	return (
		<header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-3 md:gap-3 md:pl-5">
			<Button
				iconOnly
				aria-label="返回会话列表"
				className="size-8 shrink-0 rounded-full md:hidden"
				onClick={onBack}
				size="sm"
				variant="ghost"
			>
				<ArrowLeft className="size-4" />
			</Button>
			<div className="shrink-0">
				{conversation.kind === "room" ? (
					<Avatar size={40} shape="square" icon={<Hash className="size-5" />} alt="" />
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
			{conversation.kind === "room" && roles.length > 0 && (
				<div className="hidden shrink-0 sm:block">
					<AvatarGroup
						size={24}
						max={3}
						aria-label={`${roles.length} 个角色在场`}
						items={roles.map(({ user }) => ({
							name: user.display_name,
							src: user.avatar_url,
						}))}
					/>
				</div>
			)}
			<Button
				iconOnly
				aria-label="搜索消息"
				aria-expanded={searchOpen}
				className="size-8 shrink-0 rounded-full"
				onClick={onToggleSearch}
				size="sm"
				variant="ghost"
			>
				<Search className="size-4" />
			</Button>
			<Button
				ref={details}
				iconOnly
				aria-label="打开会话详情"
				aria-expanded={showDetails}
				className="size-8 shrink-0 rounded-full"
				onClick={onToggleDetails}
				size="sm"
				variant="ghost"
			>
				<PanelRight className="size-4" />
			</Button>
		</header>
	);
}
