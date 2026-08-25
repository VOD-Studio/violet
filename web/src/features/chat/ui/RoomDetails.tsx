/**
 * 会话详情抽屉：成员管理、邀请、通知设置与离开会话。
 */

import { Button } from "@shared/ui/base/button";
import { Bell, BellOff, LoaderCircle, LogOut, Plus, ShieldCheck, Users, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchChatUser } from "../api/client";
import {
	useInviteChatMember,
	useLeaveChatConversation,
	useRemoveChatMember,
	useRenameChatConversation,
	useSetChatMuted,
} from "../api/queries";
import { useChatPushNotifications } from "../hooks/useChatPushNotifications";
import { conversationLabel, conversationTargetUser } from "../lib/conversation";
import type { ChatConversation, ChatMember } from "../model/types";
import { ChatAvatar } from "./ChatAvatar";

export interface RoomDetailsProps {
	/** 当前会话。 */
	conversation: ChatConversation;
	/** 当前用户 ID。 */
	currentUserID: string;
	/** 当前有效成员。 */
	members: ChatMember[];
	/** 关闭详情抽屉。 */
	onClose: () => void;
}

export function RoomDetails({ conversation, currentUserID, members, onClose }: RoomDetailsProps) {
	const [title, setTitle] = useState(conversation.title);
	const [inviteUsername, setInviteUsername] = useState("");
	const rename = useRenameChatConversation();
	const invite = useInviteChatMember();
	const remove = useRemoveChatMember();
	const mute = useSetChatMuted();
	const leave = useLeaveChatConversation();
	const currentMember = members.find((member) => member.user.id === currentUserID);
	const isOwner = currentMember?.role === "owner";
	useEffect(() => {
		setTitle(conversation.title);
	}, [conversation.title]);

	const saveTitle = async () => {
		if (conversation.kind !== "room" || !title.trim() || title === conversation.title) return;
		await rename.mutateAsync({ id: conversation.id, title: title.trim() });
	};

	const inviteUser = async () => {
		if (!inviteUsername.trim()) return;
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
		<motion.aside
			initial={{ x: "100%", opacity: 0 }}
			animate={{ x: 0, opacity: 1 }}
			exit={{ x: "100%", opacity: 0 }}
			transition={{ type: "spring", stiffness: 350, damping: 32 }}
			className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-border bg-card/95 backdrop-blur-xl sm:w-80 xl:static xl:z-auto xl:shadow-none"
		>
			<header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
				<h3 className="text-sm font-semibold text-foreground">会话详情</h3>
				<Button aria-label="关闭详情" onClick={onClose} size="icon-sm" variant="ghost">
					<X className="size-4" />
				</Button>
			</header>
			<div className="flex-1 space-y-5 overflow-y-auto p-4">
				<div className="rounded-2xl border border-border bg-secondary/40 p-4">
					<div className="mb-2.5 flex items-center gap-3">
						<ChatAvatar
							user={conversationTargetUser(conversation, currentUserID)}
							className="size-11"
						/>
						<div className="min-w-0">
							<p className="truncate text-sm font-semibold text-foreground">
								{conversationLabel(conversation, currentUserID)}
							</p>
							<p className="text-xs text-muted-foreground">
								{conversation.kind === "room" ? "群聊" : "私聊"}
							</p>
						</div>
					</div>
					{conversation.kind === "room" && isOwner && (
						<input
							aria-label="房间名称"
							className="mt-2 h-9 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
							onBlur={() => void saveTitle()}
							onChange={(event) => setTitle(event.target.value)}
							value={title}
						/>
					)}
				</div>

				<div>
					<div className="mb-2.5 flex items-center justify-between px-1">
						<p className="text-xs text-muted-foreground">成员 · {members.length}</p>
						<Users className="size-3.5 text-muted-foreground" />
					</div>
					<div className="space-y-1">
						{members.map((member) => (
							<div
								className="flex items-center gap-2.5 rounded-xl p-2 transition-colors hover:bg-secondary/40"
								key={member.user.id}
							>
								<ChatAvatar user={member.user} className="size-7.5" />
								<div className="min-w-0 flex-1">
									<p className="truncate text-xs font-medium text-foreground">
										{member.user.display_name}
									</p>
									<p className="truncate font-mono text-[11px] text-muted-foreground">
										@{member.user.username}
									</p>
								</div>
								{member.role === "owner" ? (
									<ShieldCheck className="size-4 text-muted-foreground" />
								) : (
									isOwner && (
										<button
											aria-label={`移除 ${member.user.display_name}`}
											className="text-muted-foreground transition hover:text-destructive"
											disabled={remove.isPending}
											onClick={() =>
												remove.mutate({
													id: conversation.id,
													userId: member.user.id,
												})
											}
											type="button"
										>
											<X className="size-3.5" />
										</button>
									)
								)}
							</div>
						))}
					</div>
				</div>

				{conversation.kind === "room" && currentMember && (
					<div className="rounded-2xl border border-dashed border-border p-3.5">
						<p className="mb-2 text-xs text-muted-foreground">邀请成员</p>
						<div className="flex gap-2">
							<input
								aria-label="邀请用户名"
								className="h-9 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
								onChange={(event) => setInviteUsername(event.target.value)}
								onKeyDown={(event) => event.key === "Enter" && void inviteUser()}
								placeholder="username"
								value={inviteUsername}
							/>
							<Button
								disabled={invite.isPending}
								onClick={() => void inviteUser()}
								size="icon-sm"
								className="size-9 rounded-xl"
							>
								<Plus className="size-4" />
							</Button>
						</div>
						<p className="mt-2 text-xs text-muted-foreground">
							所有成员都可以邀请新成员
						</p>
					</div>
				)}

				<NotificationSettings
					muted={currentMember?.is_muted ?? false}
					onMute={(muted) => mute.mutate({ id: conversation.id, muted })}
				/>

				<div className="border-t border-border pt-3">
					<Button
						className="w-full justify-start rounded-xl text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
						disabled={leave.isPending}
						onClick={async () => {
							try {
								await leave.mutateAsync(conversation.id);
								onClose();
							} catch {
								toast.error("无法离开会话", { description: "请稍后重试" });
							}
						}}
						variant="ghost"
						size="sm"
					>
						<LogOut className="mr-2 size-3.5" />
						离开会话
					</Button>
				</div>
			</div>
		</motion.aside>
	);
}

function NotificationSettings({
	muted,
	onMute,
}: {
	muted: boolean;
	onMute: (muted: boolean) => void;
}) {
	const push = useChatPushNotifications();
	const [showPreview, setShowPreview] = useState(false);
	const granted = push.permission === "granted";

	return (
		<div className="rounded-2xl border border-border bg-secondary/40 p-4">
			<div className="flex items-start gap-2.5">
				<div className="mt-0.5 rounded-lg bg-secondary p-1.5 text-muted-foreground">
					<Bell className="size-4" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-xs font-semibold text-foreground">桌面通知</p>
					<p className="mt-0.5 text-[11px] leading-normal text-muted-foreground">
						关闭标签页仍可收到消息提醒。
					</p>
					<Button
						className="mt-2.5 h-7.5 w-full justify-start rounded-lg text-xs"
						onClick={() => onMute(!muted)}
						size="sm"
						variant="ghost"
					>
						{muted ? (
							<BellOff className="mr-1.5 size-3.5" />
						) : (
							<Bell className="mr-1.5 size-3.5" />
						)}
						{muted ? "已静音此会话" : "静音此会话"}
					</Button>
					{push.enabled && (
						<label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
							<input
								checked={showPreview}
								onChange={(event) => {
									const next = event.target.checked;
									setShowPreview(next);
									void push.updatePreview(next);
								}}
								type="checkbox"
								className="rounded"
							/>
							显示消息摘要
						</label>
					)}
					<Button
						className="mt-2.5 h-7.5 w-full rounded-lg text-xs font-medium"
						disabled={push.busy || !push.enabled || !push.supported}
						onClick={() =>
							granted ? void push.disable() : void push.enable(showPreview)
						}
						size="sm"
						variant={granted ? "outline" : "default"}
					>
						{push.busy ? (
							<LoaderCircle className="size-3 animate-spin" />
						) : granted ? (
							"关闭浏览器通知"
						) : (
							"启用浏览器通知"
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
