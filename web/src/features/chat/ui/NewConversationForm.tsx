import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { Check, LoaderCircle, Search, Sparkles, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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
		<motion.section
			initial={{ opacity: 0, height: 0, y: -10 }}
			animate={{ opacity: 1, height: "auto", y: 0 }}
			exit={{ opacity: 0, height: 0, y: -10 }}
			transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
			className="shrink-0 overflow-hidden border-b border-edge-hairline bg-secondary/20 px-4 py-3.5 backdrop-blur-md"
		>
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					<div className="flex size-5 items-center justify-center rounded-md bg-neon-cyan/15 text-neon-cyan">
						<Sparkles className="size-3" />
					</div>
					<div>
						<p className="font-mono text-[9px] uppercase tracking-[0.2em] text-neon-cyan">
							New conversation
						</p>
						<p className="text-xs font-semibold text-foreground">发起新对话</p>
					</div>
				</div>
				<span className="flex items-center gap-1 rounded-full border border-edge-hairline bg-background/80 px-2 py-0.5 font-mono text-[10px] text-muted-foreground shadow-2xs">
					{isRoom ? (
						<>
							<Users className="size-2.5 text-neon-purple" />
							<span>群聊 ({selectedUsers.length})</span>
						</>
					) : (
						<span>私聊</span>
					)}
				</span>
			</div>

			<AnimatePresence>
				{selectedUsers.length > 0 && (
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.95 }}
						className="mb-2.5 flex flex-wrap gap-1.5"
					>
						{selectedUsers.map((user) => (
							<motion.button
								layout
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.8 }}
								aria-label={`移除 ${user.display_name}`}
								className="group inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 py-0.5 pl-1.5 pr-2 text-[11px] font-medium text-neon-cyan transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
								key={user.id}
								onClick={() => toggleUser(user)}
								type="button"
							>
								<ChatAvatar user={user} className="size-3.5" />
								<span>{user.display_name}</span>
								<X className="size-3 opacity-60 transition-opacity group-hover:opacity-100" />
							</motion.button>
						))}
					</motion.div>
				)}
			</AnimatePresence>

			<div className="relative">
				<Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
				<input
					aria-label="搜索成员"
					className="h-9 w-full rounded-xl border border-input bg-background/80 pl-8.5 pr-3 text-xs outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/15 placeholder:text-muted-foreground/70"
					onChange={(event) => setMemberSearch(event.target.value)}
					placeholder="搜索用户名或展示名"
					value={memberSearch}
				/>
			</div>

			<div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-0.5">
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
									"flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-all duration-150",
									selected
										? "border border-neon-cyan/30 bg-neon-cyan/10 text-foreground"
										: "border border-transparent text-muted-foreground hover:border-edge-hairline hover:bg-secondary/40 hover:text-foreground",
								)}
								key={user.id}
								onClick={() => toggleUser(user)}
								type="button"
							>
								<ChatAvatar user={user} className="size-8 shrink-0" />
								<span className="min-w-0 flex-1">
									<span className="block truncate text-xs font-semibold text-foreground">
										{user.display_name}
									</span>
									<span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
										@{user.username}
									</span>
								</span>
								{selected ? (
									<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neon-cyan text-primary-foreground shadow-2xs">
										<Check className="size-3" />
									</span>
								) : (
									<span className="size-5 shrink-0 rounded-full border border-edge-hairline/80 bg-background/50" />
								)}
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
				<motion.div
					initial={{ opacity: 0, height: 0 }}
					animate={{ opacity: 1, height: "auto" }}
					exit={{ opacity: 0, height: 0 }}
					className="overflow-hidden"
				>
					<input
						aria-label="群聊名称"
						className="mt-2 h-9 w-full rounded-xl border border-input bg-background/80 px-3 text-xs outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/15 placeholder:text-muted-foreground/70"
						onChange={(event) => setTitle(event.target.value)}
						placeholder="群聊名称（可选）"
						value={title}
					/>
				</motion.div>
			)}

			<Button
				className="mt-2.5 w-full text-xs font-medium shadow-xs"
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
		</motion.section>
	);
}
