import {
	iconProps,
	ListItem,
	ListItemAction,
	ListItemContent,
	ListItemDescription,
	ListItemTitle,
} from "@violet/ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { ChatMember } from "../model/types";
import { ChatAvatar } from "./ChatAvatar";

/** 列表拥有行高与悬停样式，成员行只提供身份和操作槽。 */
export interface ChatMemberRowProps {
	member: ChatMember;
	subtitle: string;
	trailing: ReactNode;
}

export function ChatMemberRow({ member, subtitle, trailing }: ChatMemberRowProps) {
	return (
		<ListItem>
			<ChatAvatar user={member.user} className="size-9" />
			<ListItemContent>
				<ListItemTitle>{member.user.display_name}</ListItemTitle>
				<ListItemDescription>{subtitle}</ListItemDescription>
			</ListItemContent>
			{trailing}
		</ListItem>
	);
}

/** 移除权限与请求状态由详情面板判断。 */
export interface RemoveMemberButtonProps {
	member: ChatMember;
	disabled: boolean;
	onRemove: () => void;
}

export function RemoveMemberButton({ member, disabled, onRemove }: RemoveMemberButtonProps) {
	return (
		<ListItemAction
			aria-label={`移除 ${member.user.display_name}`}
			disabled={disabled}
			onClick={onRemove}
		>
			<X {...iconProps(16)} />
		</ListItemAction>
	);
}
