import { stripPlaceholdersForPreview } from "@shared/ui/rich-text-input/use-rich-text-input";
import { cn } from "cn";
import type { ChatMessageReference } from "../model/types";

interface MessageReplyPreviewProps {
	reference: ChatMessageReference;
	onClick?: () => void;
}

/** 引用快照只展示预览文本，原消息删除后不再提供跳转。 */
export function MessageReplyPreview({ reference, onClick }: MessageReplyPreviewProps) {
	const fallback =
		reference.type === "image"
			? "图片消息"
			: reference.type === "tweet_share"
				? "分享了一条推文"
				: reference.type === "music_share"
					? "分享了一首歌曲"
					: "文本消息";
	const content = reference.is_deleted
		? "消息已删除"
		: stripPlaceholdersForPreview(reference.content ?? "").trim() || fallback;
	const className =
		"mb-1.5 flex w-full min-w-0 items-center gap-2 rounded-lg bg-foreground/5 px-2.5 py-1.5 text-left text-[13px] leading-normal text-muted-foreground";
	const body = (
		<>
			<div className="min-w-0 flex-1">
				<p className="truncate font-semibold text-selected-foreground">
					{reference.sender.display_name}
				</p>
				<p className="truncate">{content}</p>
			</div>
			{reference.type === "image" && reference.media && !reference.is_deleted && (
				<img
					alt="引用的聊天图片"
					className="size-10 shrink-0 rounded object-cover"
					src={reference.media.thumbnail ?? reference.media.url}
				/>
			)}
		</>
	);
	if (!onClick || reference.is_deleted) {
		return <div className={className}>{body}</div>;
	}
	return (
		<button
			aria-label={`跳转到${reference.sender.display_name}的引用消息`}
			className={cn(
				className,
				"transition-colors hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-ring",
			)}
			onClick={onClick}
			type="button"
		>
			{body}
		</button>
	);
}
