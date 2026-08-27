import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { Check, LoaderCircle, Search, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
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
	const searchRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		searchRef.current?.focus();
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

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
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="absolute inset-0 z-30 flex flex-col bg-background"
		>
			<header className="flex h-14 shrink-0 items-center gap-3 px-4">
				<Button
					aria-label="关闭新建会话"
					className="size-9 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
					onClick={onClose}
					size="icon"
					variant="ghost"
				>
					<X className="size-5" />
				</Button>
				<h2 className="text-lg font-semibold text-foreground">
					{isRoom ? "新建群聊" : "发起私聊"}
				</h2>
			</header>

			<div className="px-4 pb-2">
				<div className="relative">
					<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<input
						aria-label="搜索成员"
						className="h-10 w-full rounded-full border-none bg-secondary pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
						onChange={(event) => setMemberSearch(event.target.value)}
						placeholder="搜索用户名或展示名"
						ref={searchRef}
						value={memberSearch}
					/>
				</div>
			</div>

			<AnimatePresence>
				{selectedUsers.length > 0 && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						className="overflow-hidden px-4"
					>
						<div className="mb-2 flex flex-wrap gap-1.5 pb-2">
							{selectedUsers.map((user) => (
								<button
									aria-label={`移除 ${user.display_name}`}
									className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-0.5 pl-1.5 pr-2 text-xs font-medium text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
									key={user.id}
									onClick={() => toggleUser(user)}
									type="button"
								>
									<ChatAvatar user={user} className="size-4" />
									<span>{user.display_name}</span>
									<X className="size-3 opacity-60" />
								</button>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			<div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
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
								<ChatAvatar user={user} className="size-11 shrink-0" />
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

			<div className="shrink-0 border-t border-border p-3">
				{isRoom && (
					<input
						aria-label="群聊名称"
						className="mb-2 h-11 w-full rounded-xl border-none bg-secondary px-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
						onChange={(event) => setTitle(event.target.value)}
						placeholder="群聊名称（可选）"
						value={title}
					/>
				)}
				<Button
					className="h-11 w-full rounded-xl text-sm font-semibold"
					disabled={busy || selectedUsers.length === 0}
					onClick={() => void submit()}
				>
					{busy ? (
						<LoaderCircle className="size-4 animate-spin" />
					) : (
						<>
							<Users className="size-4" />
							{isRoom ? "创建群聊" : "发起私聊"}
						</>
					)}
				</Button>
			</div>
		</motion.div>
	);
}
