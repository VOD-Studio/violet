import {
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	iconProps,
} from "@violet/ui";

import { cn } from "cn";
import { Check, Search, Users, X } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { useChatContacts, useCreateChatConversation } from "../api/queries";
import type { ChatUser } from "../model/types";
import { ChatAvatar } from "./ChatAvatar";
import { ChatContactSkeleton } from "./ChatContactSkeleton";

export interface NewConversationFormProps {
	/** 创建成功后接收新会话 ID。 */
	onCreated: (id: string) => void;
	/** 关闭浮层。 */
	onClose: () => void;
}

/** 新建会话浮层：私聊/群聊合一，搜索选人后创建。 */
export function NewConversationForm({ onCreated, onClose }: NewConversationFormProps) {
	const [memberSearch, setMemberSearch] = useState("");
	const [selectedUsers, setSelectedUsers] = useState<ChatUser[]>([]);
	const [title, setTitle] = useState("");
	const [busy, setBusy] = useState(false);
	const deferredSearch = useDeferredValue(memberSearch.trim());
	const contactsQuery = useChatContacts(deferredSearch);
	const contacts = contactsQuery.data?.pages.flatMap((page) => page.data) ?? [];
	const create = useCreateChatConversation();
	const isRoom = selectedUsers.length > 1;
	const toggleUser = (user: ChatUser) => {
		setSelectedUsers((current) =>
			current.some((selected) => selected.id === user.id)
				? current.filter((selected) => selected.id !== user.id)
				: [...current, user],
		);
	};

	const submit = async () => {
		if (selectedUsers.length === 0) return;
		setBusy(true);
		try {
			const conversation = await create.mutateAsync({
				kind: isRoom ? "room" : "direct",
				title: isRoom ? title.trim() || undefined : undefined,
				participant_ids: selectedUsers.map((user) => user.id),
			});
			onCreated(conversation.id);
		} catch {
			toast.error("无法创建会话", { description: "请确认成员选择后重试" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent size="sm" showCloseButton={false} aria-describedby={undefined}>
				<DialogHeader className="flex-row items-center gap-3">
					<Button
						iconOnly
						aria-label="关闭新建会话"
						className="size-9 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
						onClick={onClose}
						size="md"
						variant="ghost"
					>
						<X className="size-5" />
					</Button>
					<DialogTitle>{isRoom ? "新建群聊" : "发起私聊"}</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<div className="pb-3">
						<Input
							aria-label="搜索成员"
							type="search"
							leading={<Search />}
							onChange={(event) => setMemberSearch(event.target.value)}
							placeholder="搜索用户名或展示名"
							value={memberSearch}
						/>
					</div>

					{selectedUsers.length > 0 && (
						<div className="flex flex-wrap gap-1.5 pb-3">
							{selectedUsers.map((user) => (
								<button
									aria-label={`移除 ${user.display_name}`}
									className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-0.5 pl-1.5 pr-2 text-xs font-medium text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
									key={user.id}
									onClick={() => toggleUser(user)}
									type="button"
								>
									<ChatAvatar user={user} className="size-4" linked={false} />
									<span>{user.display_name}</span>
									<X {...iconProps(12, "opacity-60")} />
								</button>
							))}
						</div>
					)}

					<div className="space-y-1">
						{contactsQuery.isLoading ? (
							<ChatContactSkeleton />
						) : contactsQuery.isError ? (
							<p className="px-4 py-6 text-center text-sm text-destructive">
								成员加载失败，请稍后重试
							</p>
						) : contacts.length > 0 ? (
							contacts.map((user) => {
								const selected = selectedUsers.some((item) => item.id === user.id);
								return (
									<button
										aria-pressed={selected}
										aria-label={`${selected ? "取消选择" : "选择"} ${user.display_name}`}
										className={cn(
											"flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors",
											selected
												? "bg-accent text-foreground"
												: "text-foreground hover:bg-secondary",
										)}
										key={user.id}
										onClick={() => toggleUser(user)}
										type="button"
									>
										<ChatAvatar
											user={user}
											className="size-11 shrink-0"
											linked={false}
										/>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-[0.95rem] font-medium text-foreground">
												{user.display_name}
											</span>
											<span className="mt-0.5 block truncate text-sm text-muted-foreground">
												@{user.username}
											</span>
										</span>
										<span
											className={cn(
												"flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
												selected
													? "border-primary bg-primary text-primary-foreground"
													: "border-muted-foreground/40",
											)}
										>
											{selected && <Check className="size-4" />}
										</span>
									</button>
								);
							})
						) : (
							<p className="px-4 py-6 text-center text-sm text-muted-foreground">
								{deferredSearch ? "没有匹配的用户" : "输入用户名搜索成员"}
							</p>
						)}
					</div>
				</DialogBody>
				<DialogFooter className="flex-col">
					{isRoom && (
						<Input
							aria-label="群聊名称"
							classNames={{ control: "mb-2" }}
							onChange={(event) => setTitle(event.target.value)}
							placeholder="群聊名称（可选）"
							value={title}
						/>
					)}
					<Button
						className="h-11 w-full rounded-xl text-sm font-semibold"
						disabled={busy || selectedUsers.length === 0}
						loading={busy}
						leftIcon={<Users className="size-4" />}
						onClick={() => void submit()}
					>
						{isRoom ? "创建群聊" : "发起私聊"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
