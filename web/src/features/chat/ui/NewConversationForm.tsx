import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { LoaderCircle, Search, X } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { useChatContacts, useCreateChatConversation } from "../api/queries";
import type { ChatUser } from "../model/types";
import { ChatAvatar } from "./ChatAvatar";
import { ChatContactSkeleton } from "./ChatContactSkeleton";

export interface NewConversationFormProps {
	/** 创建成功后接收新会话 ID。 */
	onCreated: (id: string) => void;
}

/** 搜索并选择成员，创建私聊或群聊。 */
export function NewConversationForm({ onCreated }: NewConversationFormProps) {
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
			setMemberSearch("");
			setSelectedUsers([]);
			setTitle("");
		} catch {
			toast.error("无法创建会话", { description: "请确认成员选择后重试" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<section className="shrink-0 border-b border-edge-hairline bg-secondary/15 px-4 py-3">
			<div className="mb-2.5 flex items-center justify-between">
				<div>
					<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
						New conversation
					</p>
					<p className="mt-1 text-xs font-semibold">新建对话</p>
				</div>
				<span className="rounded-full bg-background/70 px-2 py-1 font-mono text-[10px] text-muted-foreground">
					{isRoom ? "群聊" : "私聊"}
				</span>
			</div>
			{selectedUsers.length > 0 && (
				<div className="mb-2 flex flex-wrap gap-1.5">
					{selectedUsers.map((user) => (
						<button
							aria-label={`移除 ${user.display_name}`}
							className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2 py-1 text-[10px] text-neon-cyan"
							key={user.id}
							onClick={() => toggleUser(user)}
							type="button"
						>
							{user.display_name}
							<X className="size-3" />
						</button>
					))}
				</div>
			)}
			<div className="relative">
				<Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
				<input
					aria-label="搜索成员"
					className="h-9 w-full rounded-lg border border-input bg-background pl-8.5 pr-3 text-xs outline-none transition focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/20"
					onChange={(event) => setMemberSearch(event.target.value)}
					placeholder="搜索用户名或展示名"
					value={memberSearch}
				/>
			</div>
			<div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
				{contactsQuery.isLoading ? (
					<ChatContactSkeleton />
				) : contactsQuery.isError ? (
					<p className="px-2 py-3 text-center text-[11px] text-destructive">
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
									"flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
									selected
										? "bg-neon-cyan/10 text-neon-cyan"
										: "hover:bg-secondary/50",
								)}
								key={user.id}
								onClick={() => toggleUser(user)}
								type="button"
							>
								<ChatAvatar user={user} className="size-8 shrink-0" />
								<span className="min-w-0 flex-1">
									<span className="block truncate text-xs font-medium">
										{user.display_name}
									</span>
									<span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
										@{user.username}
									</span>
								</span>
								{selected && <span className="text-[10px]">已选</span>}
							</button>
						);
					})
				) : (
					<p className="px-2 py-3 text-center text-[11px] text-muted-foreground">
						输入用户名搜索成员
					</p>
				)}
			</div>
			{isRoom && (
				<input
					aria-label="群聊名称"
					className="mt-2 h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none transition focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan/20"
					onChange={(event) => setTitle(event.target.value)}
					placeholder="群聊名称（可选）"
					value={title}
				/>
			)}
			<Button
				className="mt-2.5 w-full text-xs"
				disabled={busy || selectedUsers.length === 0}
				onClick={() => void submit()}
				size="sm"
			>
				{busy ? (
					<LoaderCircle className="size-3.5 animate-spin" />
				) : isRoom ? (
					"创建群聊"
				) : (
					"发起私聊"
				)}
			</Button>
		</section>
	);
}
