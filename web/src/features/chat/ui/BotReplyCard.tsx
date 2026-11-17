import { Accordion, AccordionItem, Button, iconProps, Spinner } from "@violet/ui";
import { Copy } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "../model/types";
import { ToolCallBlock } from "./BotToolCalls";
import { ChatMessageContent, type ChatMessageContentProps } from "./ChatMessageContent";

const STALLED_AFTER_MS = 120_000;

/** Bot 回复卡片的消息与交互。 */
export interface BotReplyCardProps {
	message: ChatMessage;
	viewerID: string;
	emote?: ChatMessage["custom_emote"];
	onImage?: ChatMessageContentProps["onImage"];
	replyPreview?: ReactNode;
}

/** 展示 Bot 的 Markdown 回复、思考内容和生成状态。 */
export function BotReplyCard({
	message,
	viewerID,
	emote,
	onImage,
	replyPreview,
}: BotReplyCardProps) {
	const reply = message.bot_reply;
	const [expanded, setExpanded] = useState<string[]>(
		reply?.thinking_default_expanded ? ["thinking"] : [],
	);
	const [stalled, setStalled] = useState(false);
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
		if (remaining <= 0) {
			return;
		}
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
	const toolCalls = reply?.tool_calls ?? [];
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
			data-chat-bubble
			className="w-full min-w-0 rounded-2xl rounded-bl bg-card px-3 py-2 text-left text-foreground shadow-soft"
		>
			{status && (
				<div
					className="flex items-center gap-1 text-xs text-muted-foreground"
					role="status"
					aria-live="polite"
				>
					{active && !stalled && <Spinner size={16} aria-hidden="true" />}
					{status}
				</div>
			)}
			{replyPreview && <div className="mt-3">{replyPreview}</div>}
			{(reply?.thinking || toolCalls.length > 0) && (
				<Accordion
					type="multiple"
					value={expanded}
					onValueChange={setExpanded}
					className="mt-3"
				>
					{reply?.thinking && (
						<AccordionItem value="thinking" title="思考过程">
							<div className="flex justify-end">
								<Button
									iconOnly
									variant="ghost"
									size="sm"
									aria-label="复制思考内容"
									onClick={() => void copyThinking()}
								>
									<Copy {...iconProps(16)} />
								</Button>
							</div>
							<ChatMessageContent
								content={reply.thinking}
								variant="bot"
								viewerID={viewerID}
							/>
						</AccordionItem>
					)}
					{toolCalls.length > 0 && (
						<AccordionItem value="tools" title={`工具调用 (${toolCalls.length})`}>
							<ol className="min-w-0 space-y-2">
								{toolCalls.map((call, index) => (
									<ToolCallBlock
										key={call.id ?? `${call.name}-${index}`}
										call={call}
										replySettled={replySettled}
									/>
								))}
							</ol>
						</AccordionItem>
					)}
				</Accordion>
			)}
			{message.content && (
				<div className="mt-1 min-w-0 text-[15px] leading-[1.7]">
					<ChatMessageContent
						content={message.content}
						emote={emote}
						mentions={message.mentions}
						onImage={onImage}
						variant="bot"
						viewerID={viewerID}
					/>
				</div>
			)}
		</div>
	);
}
