/**
 * 会话详情抽屉：成员管理、邀请、通知设置与离开会话。
 */

import { Button, Input, iconProps, List, Switch, Tag } from "@violet/ui";

import { Bot, LogOut, Plus, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchChatUser } from "../api/client";
import {
	useBotCommands,
	useInviteChatMember,
	useLeaveChatConversation,
	useRemoveChatMember,
	useRenameChatConversation,
	useSetBotSpeaking,
	useSetChatMuted,
} from "../api/queries";

import type { ChatConversation, ChatMember } from "../model/types";
import { ChatMemberRow, RemoveMemberButton } from "./ChatMemberRow";
import { ChatNotificationSettings } from "./ChatNotificationSettings";
import { ConversationDetailsFrame } from "./ConversationDetailsFrame";

export interface RoomDetailsProps {
	open: boolean;
	/** 当前会话。 */
	conversation: ChatConversation;
	/** 当前用户 ID。 */
	currentUserID: string;
	/** 当前有效成员。 */
	members: ChatMember[];
	/** 关闭详情抽屉。 */
	onClose: () => void;
}

/** 详情会话随 Sheet 内容挂载，关闭动画结束后释放。 */
export function RoomDetails(props: RoomDetailsProps) {
	return (
		<ConversationDetailsFrame open={props.open} onClose={props.onClose}>
			<RoomDetailsContent {...props} />
		</ConversationDetailsFrame>
	);
}

function RoomDetailsContent({
	open,
	conversation,
	currentUserID,
	members,
	onClose,
}: RoomDetailsProps) {
	const [title, setTitle] = useState(conversation.title);
	const [inviteUsername, setInviteUsername] = useState("");
	const rename = useRenameChatConversation();
	const invite = useInviteChatMember();
	const remove = useRemoveChatMember();
	const mute = useSetChatMuted();
	const speaking = useSetBotSpeaking();
	const leave = useLeaveChatConversation();
	const botCommands = useBotCommands(conversation.id);
	const currentMember = members.find((member) => member.user.id === currentUserID);
	const people = members.filter((member) => !member.user.is_bot);
	const roles = members.filter((member) => member.user.is_bot);
	const descriptions = new Map(
		(botCommands.data?.bots ?? []).map((bot) => [bot.bot_user_id, bot.description]),
	);
	const isOwner = currentMember?.role === "owner";
	useEffect(() => {
		if (!open) return;
		setTitle(conversation.title);
		setInviteUsername("");
	}, [conversation.title, open]);

	const saveTitle = async () => {
		if (conversation.kind !== "room" || !title.trim() || title === conversation.title) {
			return;
		}
		await rename.mutateAsync({ id: conversation.id, title: title.trim() });
	};

	const inviteUser = async () => {
		if (!inviteUsername.trim()) {
			return;
		}
		try {
			const user = await fetchChatUser(inviteUsername.trim());
			await invite.mutateAsync({ id: conversation.id, userId: user.id });
			setInviteUsername("");
			toast.success("成员已加入房间");
		} catch {
			toast.error("邀请失败", { description: "请确认用户名" });
		}
	};

	return (
		<>
			{conversation.kind === "room" && isOwner && (
				<Input
					aria-label="房间名称"
					value={title}
					onBlur={() => void saveTitle()}
					onChange={(event) => setTitle(event.target.value)}
					variant="underline"
				/>
			)}
			{roles.length > 0 && (
				<section aria-label="在场的角色">
					<div className="mb-2.5 flex items-center justify-between px-1">
						<p className="text-xs text-muted-foreground">在场的角色 · {roles.length}</p>
						<Bot {...iconProps(14, "text-muted-foreground")} />
					</div>
					{botCommands.isError && (
						<p className="mb-2 px-1 text-[11px] text-muted-foreground">
							角色简介暂时无法加载
						</p>
					)}
					<List>
						{roles.map((member) => (
							<ChatMemberRow
								key={member.user.id}
								member={member}
								subtitle={
									descriptions.get(member.user.id) || `@${member.user.username}`
								}
								trailing={
									<>
										{isOwner ? (
											<Switch
												aria-label={`允许 ${member.user.display_name} 发言`}
												checked={member.can_speak}
												disabled={speaking.isPending}
												onCheckedChange={(allowed) =>
													speaking.mutate({
														id: conversation.id,
														userId: member.user.id,
														allowed,
													})
												}
											/>
										) : (
											!member.can_speak && (
												<span className="text-[11px] text-muted-foreground">
													已禁言
												</span>
											)
										)}
										{isOwner && (
											<RemoveMemberButton
												disabled={remove.isPending}
												member={member}
												onRemove={() =>
													remove.mutate({
														id: conversation.id,
														userId: member.user.id,
													})
												}
											/>
										)}
									</>
								}
							/>
						))}
					</List>
				</section>
			)}

			<div>
				<div className="mb-2.5 flex items-center justify-between px-1">
					<p className="text-xs text-muted-foreground">成员 · {people.length}</p>
					<Users {...iconProps(14, "text-muted-foreground")} />
				</div>
				<List>
					{people.map((member) => (
						<ChatMemberRow
							key={member.user.id}
							member={member}
							subtitle={`@${member.user.username}`}
							trailing={
								<>
									{member.user.is_site_owner && (
										<Tag size="sm" tone="accent">
											站长
										</Tag>
									)}
									{member.role === "owner" ? (
										<ShieldCheck className="size-4 text-muted-foreground" />
									) : (
										isOwner && (
											<RemoveMemberButton
												disabled={remove.isPending}
												member={member}
												onRemove={() =>
													remove.mutate({
														id: conversation.id,
														userId: member.user.id,
													})
												}
											/>
										)
									)}
								</>
							}
						/>
					))}
				</List>
			</div>

			{conversation.kind === "room" && currentMember && (
				<div>
					<p className="mb-2 text-xs text-muted-foreground">邀请成员</p>
					<div className="flex gap-2">
						<Input
							aria-label="邀请用户名"
							classNames={{ control: "min-w-0 flex-1" }}
							onChange={(event) => setInviteUsername(event.target.value)}
							onKeyDown={(event) => event.key === "Enter" && void inviteUser()}
							placeholder="username"
							value={inviteUsername}
						/>
						<Button
							disabled={invite.isPending}
							onClick={() => void inviteUser()}
							iconOnly
							size="sm"
							aria-label="邀请成员"
						>
							<Plus className="size-4" />
						</Button>
					</div>
					<p className="mt-2 text-xs text-muted-foreground">所有成员都可以邀请新成员</p>
				</div>
			)}

			<ChatNotificationSettings
				muted={currentMember?.is_muted ?? false}
				onMute={(muted) => mute.mutate({ id: conversation.id, muted })}
			/>

			<div className="border-t border-border pt-3">
				<Button
					className="w-full"
					disabled={leave.isPending}
					onClick={async () => {
						try {
							await leave.mutateAsync(conversation.id);
							onClose();
						} catch {
							toast.error("无法离开会话", { description: "请稍后重试" });
						}
					}}
					variant="destructive"
					size="sm"
				>
					<LogOut {...iconProps(14)} />
					离开会话
				</Button>
			</div>
		</>
	);
}
