import { Copy, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ChatMessage, ChatUser } from "../model/types";
import { ChatMessageContent } from "./ChatMessageContent";

const STALLED_AFTER_MS = 120_000;

/** Bot 回复卡片的消息与交互。 */
export interface BotReplyCardProps {
	message: ChatMessage;
	viewerID: string;
	emote?: ChatMessage["custom_emote"];
	onMention?: (user: ChatUser) => void;
	replyPreview?: ReactNode;
}

/** 展示 Bot 的 Markdown 回复、思考内容和生成状态。 */
export function BotReplyCard({
	message,
	viewerID,
	emote,
	onMention,
	replyPreview,
}: BotReplyCardProps) {
	const reply = message.bot_reply;
	const [thinkingOpen, setThinkingOpen] = useState(reply?.thinking_default_expanded ?? false);
	const [stalled, setStalled] = useState(false);
	const reducedMotion = useReducedMotion();
	const active =
		reply?.status === "pending" ||
		reply?.status === "thinking" ||
		reply?.status === "streaming";

	useEffect(() => {
		if (!active || !reply) {
			setStalled(false);
			return;
		}
		const remaining = STALLED_AFTER_MS - (Date.now() - Date.parse(reply.updated_at));
		setStalled(remaining <= 0);
		if (remaining <= 0) return;
		const timer = window.setTimeout(() => setStalled(true), remaining);
		return () => window.clearTimeout(timer);
	}, [active, reply]);

	const status =
		reply?.status === "failed"
			? "回复未完成"
			: stalled
				? "等待 Bot 更新"
				: reply?.status === "pending"
					? "等待回复…"
					: reply?.status === "thinking"
						? "正在思考…"
						: reply?.status === "streaming"
							? "正在回复…"
							: "";
	const thinkingID = `bot-thinking-${message.id}`;
	const copyThinking = async () => {
		try {
			await navigator.clipboard.writeText(reply?.thinking ?? "");
			toast.success("已复制思考内容");
		} catch {
			toast.error("复制失败");
		}
	};

	return (
		<div
			data-testid="bot-reply-card"
			className="w-full min-w-0 rounded-xl border border-border bg-card px-4 py-3 text-left text-foreground"
		>
			<div className="flex flex-wrap items-center gap-2 text-xs">
				<button
					className="font-medium text-foreground hover:underline disabled:cursor-default disabled:no-underline"
					disabled={!onMention}
					onClick={() => onMention?.(message.sender)}
					type="button"
				>
					{message.sender.display_name}
				</button>
				<span className="rounded bg-brand-wash px-1.5 py-0.5 font-medium text-brand-wash-foreground">
					BOT
				</span>
				{status && (
					<span
						className="ml-auto flex items-center gap-1 text-muted-foreground"
						role="status"
						aria-live="polite"
					>
						{active && !stalled && (
							<LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
						)}
						{status}
					</span>
				)}
			</div>
			{replyPreview && <div className="mt-3">{replyPreview}</div>}
			{reply?.thinking && (
				<div className="mt-3 border-t border-border pt-2">
					<div className="flex items-center justify-between gap-2">
						<button
							aria-controls={thinkingID}
							aria-expanded={thinkingOpen}
							className="text-xs text-muted-foreground hover:text-foreground"
							onClick={() => setThinkingOpen((open) => !open)}
							type="button"
						>
							{thinkingOpen ? "▾" : "▸"} 思考过程
						</button>
						{thinkingOpen && (
							<button
								aria-label="复制思考内容"
								className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
								onClick={() => void copyThinking()}
								type="button"
							>
								<Copy aria-hidden="true" className="size-3.5" />
							</button>
						)}
					</div>
					<div id={thinkingID} aria-hidden={!thinkingOpen} inert={!thinkingOpen}>
						<AnimatePresence initial={false}>
							{thinkingOpen && (
								<motion.div
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: "auto", opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									transition={{
										duration: reducedMotion ? 0 : 0.2,
										ease: "easeOut",
									}}
									className="overflow-hidden"
								>
									<div className="pt-2 text-sm text-muted-foreground">
										<ChatMessageContent
											content={reply.thinking}
											variant="bot"
											viewerID={viewerID}
										/>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			)}
			{message.content && (
				<div className="mt-3 min-w-0 border-t border-border pt-3 text-sm leading-relaxed">
					<ChatMessageContent
						content={message.content}
						emote={emote}
						mentions={message.mentions}
						variant="bot"
						viewerID={viewerID}
					/>
				</div>
			)}
		</div>
	);
}
