/**
 * 消息内联编辑器：在气泡原位修订消息，Enter 保存、Esc 取消。
 * 图片消息可增删图片但至少保留一张；推文分享消息只编辑配文。
 */
import { extractImageIds } from "@features/comments/hooks/use-rich-text-input";
import { type PictureInput, RichCommentInput } from "@features/comments/ui/RichCommentInput";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { Check, LoaderCircle, X } from "lucide-react";
import { type KeyboardEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { useEditChatMessage } from "../api/queries";
import { imageBubbleContent } from "../lib/conversation";
import type { ChatMessage } from "../model/types";

interface MessageEditComposerProps {
	message: ChatMessage;
	onClose: () => void;
}

export function MessageEditComposer({ message, onClose }: MessageEditComposerProps) {
	const isImage = message.type === "image";
	// 编辑初值用归一化正文：旧格式消息缺失的占位符被前置补齐，否则预填图在编辑器里不渲染、保存时被静默丢弃。
	const initialContent = useMemo(
		() => (isImage ? imageBubbleContent(message) : (message.content ?? "")),
		[message, isImage],
	);
	const initialImages = useMemo(
		() =>
			(message.media ?? []).map((media) => ({
				id: media.id,
				url: media.url,
				width: media.width ?? 0,
				height: media.height ?? 0,
				size: media.size,
			})),
		[message],
	);
	const [value, setValue] = useState(initialContent);
	const [images, setImages] = useState<PictureInput[]>(initialImages);
	const [uploading, setUploading] = useState(false);
	const edit = useEditChatMessage();

	// 与发送路径同一口径：媒体列表从正文占位符推导，剔除未上传完成与重复项。
	const uploadedIDs = new Set(images.filter((img) => !!img.id).map((img) => img.id as string));
	const mediaIDs = extractImageIds(value).filter(
		(id, index, ids) => uploadedIDs.has(id) && ids.indexOf(id) === index,
	);
	const initialMediaIDs = initialImages.map((img) => img.id);
	const mediaChanged =
		isImage &&
		(mediaIDs.length !== initialMediaIDs.length ||
			mediaIDs.some((id, index) => id !== initialMediaIDs[index]));
	const dirty = value.trim() !== initialContent.trim() || mediaChanged;
	const canSave =
		dirty &&
		!uploading &&
		!edit.isPending &&
		(isImage ? mediaIDs.length > 0 : message.type === "text" ? value.trim() !== "" : true);

	const save = () => {
		if (!canSave) return;
		edit.mutate(
			{
				conversationID: message.conversation_id,
				messageID: message.id,
				input: { content: value.trim(), media_ids: isImage ? mediaIDs : undefined },
			},
			{
				onSuccess: onClose,
				onError: () => toast.error("消息编辑失败，请重试"),
			},
		);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Escape") {
			event.preventDefault();
			onClose();
		}
	};

	return (
		<div className="min-w-60" onKeyDown={handleKeyDown}>
			<RichCommentInput
				value={value}
				onChange={setValue}
				onSubmit={save}
				enableEmoji={true}
				enableImage={isImage}
				inlineImages={isImage}
				initialImages={isImage ? initialImages : undefined}
				uploadPurpose="chat"
				submitOnEnter={true}
				compact={true}
				layout="inline"
				placeholder="编辑消息…"
				onImagesChange={setImages}
				onUploadingChange={setUploading}
				className="rounded-xl border border-input bg-card transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20"
				toolbarEnd={
					<>
						<Button
							aria-label="取消编辑"
							title="取消（Esc）"
							onClick={onClose}
							size="icon"
							variant="ghost"
							className="rounded-full"
						>
							<X className="size-4" />
						</Button>
						<Button
							aria-label="保存编辑"
							title={
								isImage && mediaIDs.length === 0
									? "图片消息至少保留一张图片"
									: "保存（Enter），Shift+Enter 换行"
							}
							disabled={!canSave}
							onClick={save}
							size="icon"
							className={cn(
								"rounded-full transition-colors",
								canSave
									? "bg-primary text-primary-foreground hover:bg-primary/90"
									: "bg-secondary text-muted-foreground",
							)}
						>
							{edit.isPending ? (
								<LoaderCircle className="size-4 animate-spin" />
							) : (
								<Check className="size-4" />
							)}
						</Button>
					</>
				}
			/>
			<p className="mt-1 px-1 text-[11px] text-muted-foreground">
				Enter 保存 · Esc 取消{isImage && " · 至少保留一张图片"}
			</p>
		</div>
	);
}
