import { cn } from "cn";
import { AlertTriangle, Check, Copy, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import type { BotToolCall, ChatMessage, ChatUser } from "../model/types";
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
	const [toolCallsOpen, setToolCallsOpen] = useState(false);
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
	const toolCalls = reply?.tool_calls ?? [];
	const toolCallsID = `bot-tool-calls-${message.id}`;
	const replySettled = reply?.status === "completed" || reply?.status === "failed";
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
				<span className="rounded bg-selected px-1.5 py-0.5 font-medium text-selected-foreground">
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
			{toolCalls.length > 0 && (
				<div className="mt-3 min-w-0 border-t border-border pt-2">
					<button
						aria-controls={toolCallsID}
						aria-expanded={toolCallsOpen}
						className="text-xs text-muted-foreground hover:text-foreground"
						onClick={() => setToolCallsOpen((open) => !open)}
						type="button"
					>
						{toolCallsOpen ? "▾" : "▸"} 工具调用 ({toolCalls.length})
					</button>
					<div id={toolCallsID} aria-hidden={!toolCallsOpen} inert={!toolCallsOpen}>
						<AnimatePresence initial={false}>
							{toolCallsOpen && (
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
									<ol className="min-w-0 space-y-2 pt-2">
										{toolCalls.map((call, index) => (
											<ToolCallBlock
												key={call.id ?? `${call.name}-${index}`}
												call={call}
												replySettled={replySettled}
											/>
										))}
									</ol>
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

type ToolCallVisualStatus = "running" | "completed" | "failed" | "unfinished";

const TOOL_CALL_LABELS: Record<ToolCallVisualStatus, string> = {
	running: "运行中",
	completed: "已完成",
	failed: "失败",
	unfinished: "未完成",
};

const ACTION_ROW_CLASS: Record<ToolCallVisualStatus, string> = {
	running: "text-muted-foreground",
	completed: "text-success",
	failed: "text-destructive",
	unfinished: "text-warning",
};

function ToolCallStatusIcon({ status }: { status: ToolCallVisualStatus }) {
	if (status === "running")
		return (
			<LoaderCircle
				aria-hidden="true"
				className={cn("size-3.5 shrink-0 animate-spin", ACTION_ROW_CLASS.running)}
			/>
		);
	if (status === "completed")
		return (
			<Check
				aria-hidden="true"
				className={cn("size-3.5 shrink-0", ACTION_ROW_CLASS.completed)}
			/>
		);
	return (
		<AlertTriangle
			aria-hidden="true"
			className={cn("size-3.5 shrink-0", ACTION_ROW_CLASS[status])}
		/>
	);
}

function ToolCallDetail({
	label,
	value,
	tone,
}: {
	label: string;
	value: string;
	tone?: "destructive";
}) {
	return (
		<div className="mt-2 min-w-0">
			<span
				className={cn(
					"text-xs",
					tone === "destructive" ? "text-destructive" : "text-muted-foreground",
				)}
			>
				{label}
			</span>
			<pre
				className={cn(
					"mt-1 min-w-0 rounded bg-muted px-2 py-1.5 font-mono text-xs whitespace-pre-wrap wrap-break-word text-foreground",
					tone === "destructive" && "bg-destructive/5 text-destructive",
				)}
			>
				{value}
			</pre>
		</div>
	);
}

function ToolCallBlock({ call, replySettled }: { call: BotToolCall; replySettled: boolean }) {
	// 终态回复仍可能带着 running 的旧快照，此时按「未完成」呈现，不再转圈。
	const status: ToolCallVisualStatus =
		call.status === "running" && replySettled ? "unfinished" : call.status;
	const duration =
		typeof call.duration_ms === "number"
			? call.duration_ms < 1000
				? `${Math.round(call.duration_ms)}ms`
				: `${(call.duration_ms / 1000).toFixed(1)}s`
			: undefined;
	return (
		<li className="min-w-0 rounded-lg border border-border/60 px-2.5 py-2">
			<div className="flex min-w-0 flex-wrap items-center gap-1.5">
				<ToolCallStatusIcon status={status} />
				<code className="min-w-0 font-mono text-xs wrap-anywhere">{call.name}</code>
				<span className={cn("text-xs", ACTION_ROW_CLASS[status])}>
					{TOOL_CALL_LABELS[status]}
				</span>
				{duration && (
					<span className="ml-auto font-mono text-xs text-muted-foreground">
						{duration}
					</span>
				)}
			</div>
			{call.arguments ? <ToolCallDetail label="参数" value={call.arguments} /> : null}
			{call.result ? <ToolCallDetail label="结果" value={call.result} /> : null}
			{call.error ? (
				<ToolCallDetail label="错误" value={call.error} tone="destructive" />
			) : null}
		</li>
	);
}
