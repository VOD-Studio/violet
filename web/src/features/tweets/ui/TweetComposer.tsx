/** TweetComposer - 推文发布框（登录态：文本 ≤500 rune + ≤4 图，前端拦截边界） */

import type { Emoji } from "@entities/emoji/model/types";
import type { QuotedTweet, Tweet } from "@entities/tweet/model/types";
import { useMe } from "@features/auth/api/queries";
import { EmojiPicker } from "@features/emojis/ui/EmojiPicker";
import { useChunkedUpload } from "@features/upload/hooks/use-chunked-upload";
import { ApiError } from "@shared/api/error";
import { avatarUrl, contentImageUrl } from "@shared/lib/image-url";
import { isImageURL } from "@shared/lib/url";
import { Button } from "@shared/ui/base/button";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { AlertCircle, ImagePlus, Loader2, Send, Smile, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useCreateTweet } from "../api/mutations";
import { MAX_TWEET_IMAGES, MAX_TWEET_LENGTH } from "../model/types";

/** 单图最大 10MB（与通用 Uploader 默认一致） */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

type ImageStatus = "uploading" | "done" | "error";

interface ImageItem {
	/** 本地自增 id（不参与提交） */
	id: number;
	/** 上传完成后的访问 URL；上传中为空串 */
	url: string;
	/** 0-100 进度 */
	progress: number;
	status: ImageStatus;
	/** 缩略预览用（本地 object URL） */
	preview: string;
}

export interface TweetComposerProps {
	/** 引用转发的目标推文 */
	quotedTweet?: Tweet | QuotedTweet;
	/** 发布成功后的回调 */
	onSuccess?: () => void;
	/** 取消引用的回调 */
	onCancelQuote?: () => void;
}

export function TweetComposer({ quotedTweet, onSuccess, onCancelQuote }: TweetComposerProps = {}) {
	const me = useMe();
	const [content, setContent] = useState("");
	const [images, setImages] = useState<ImageItem[]>([]);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const idRef = useRef(0);
	const createTweet = useCreateTweet();
	const { uploadFile } = useChunkedUpload({ purpose: "tweet" });

	// rune 计数（按 Unicode 码点，对齐后端 utf8.RuneCountInString）
	const charCount = [...content].length;
	const remaining = MAX_TWEET_LENGTH - charCount;
	const overLimit = remaining < 0;
	const doneUrls = images.filter((i) => i.status === "done").map((i) => i.url);
	const uploading = images.some((i) => i.status === "uploading");
	const canSubmit =
		!createTweet.isPending &&
		!uploading &&
		!overLimit &&
		(content.trim().length > 0 || doneUrls.length > 0 || !!quotedTweet);
	/** 选择文件 → 逐个上传（顺序，避免并发挤占分片通道） */
	const handleFiles = async (files: FileList | null) => {
		if (!files || files.length === 0) return;
		const slots = MAX_TWEET_IMAGES - images.length;
		if (slots <= 0) {
			toast.error(`最多 ${MAX_TWEET_IMAGES} 张图`);
			return;
		}
		if (files.length > slots) {
			toast.error(`最多 ${MAX_TWEET_IMAGES} 张图，已添加前 ${slots} 张`);
		}
		const picked = Array.from(files).slice(0, slots);
		for (const file of picked) {
			if (!file.type.startsWith("image/")) {
				toast.error(`${file.name} 不是图片`);
				continue;
			}
			if (file.size > MAX_IMAGE_SIZE) {
				toast.error(`${file.name} 超过 ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
				continue;
			}
			const localId = ++idRef.current;
			const preview = URL.createObjectURL(file);
			setImages((prev) => [
				...prev,
				{ id: localId, url: "", progress: 0, status: "uploading", preview },
			]);
			try {
				const res = await uploadFile(file, (p) => {
					setImages((prev) =>
						prev.map((i) => (i.id === localId ? { ...i, progress: p.percent } : i)),
					);
				});
				setImages((prev) =>
					prev.map((i) =>
						i.id === localId ? { ...i, status: "done", url: res.url } : i,
					),
				);
				URL.revokeObjectURL(preview);
			} catch (err) {
				setImages((prev) =>
					prev.map((i) => (i.id === localId ? { ...i, status: "error" } : i)),
				);
				toastError(err, "图片上传失败");
			}
		}
		// 清空 input value 以便重复选择同一文件
		if (inputRef.current) inputRef.current.value = "";
	};

	const removeImage = (id: number) => {
		const item = images.find((i) => i.id === id);
		if (item?.preview) URL.revokeObjectURL(item.preview);
		setImages((prev) => prev.filter((i) => i.id !== id));
	};

	const handleEmojiSelect = (emoji: Emoji) => {
		const imageUrl = emoji.gif_url || emoji.url;
		const emojiText =
			imageUrl && isImageURL(imageUrl) ? `[${emoji.name}]` : emoji.text_content || emoji.name;

		const textarea = textareaRef.current;
		if (!textarea) {
			setContent((prev) => prev + emojiText);
			return;
		}

		const start = textarea.selectionStart ?? content.length;
		const end = textarea.selectionEnd ?? content.length;
		const nextContent = content.slice(0, start) + emojiText + content.slice(end);
		setContent(nextContent);

		const nextCursor = start + emojiText.length;
		requestAnimationFrame(() => {
			textarea.focus();
			textarea.setSelectionRange(nextCursor, nextCursor);
		});
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (overLimit) {
			toast.error(`正文不能超过 ${MAX_TWEET_LENGTH} 字`);
			return;
		}
		if (!content.trim() && doneUrls.length === 0 && !quotedTweet) {
			toast.error("说点什么吧");
			return;
		}
		createTweet.mutate(
			{ content: content.trim(), images: doneUrls, quote_of: quotedTweet?.id },
			{
				onSuccess: () => {
					setContent("");
					setImages([]);
					onSuccess?.();
					toast.success("已发布");
				},
				onError: (err) => toastError(err, "发布失败"),
			},
		);
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="rounded-2xl border border-edge-hairline bg-surface/30 p-4 sm:p-5 flex gap-3 transition-colors hover:bg-surface/50"
			aria-label="发布推文"
		>
			{me.data && (
				<img
					src={avatarUrl(me.data.avatar_url, me.data.username)}
					alt={me.data.username}
					className="size-10 shrink-0 rounded-full object-cover"
				/>
			)}
			<div className="flex-1 min-w-0 flex flex-col">
				<textarea
					ref={textareaRef}
					value={content}
					onChange={(e) => setContent(e.target.value)}
					placeholder="有什么新鲜事？"
					rows={3}
					className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
				/>

				{images.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-2">
						{images.map((img) => (
							<div
								key={img.id}
								className="relative size-20 overflow-hidden rounded-lg border border-edge-hairline"
							>
								<img
									src={
										img.status === "done"
											? contentImageUrl(img.url, { width: 200 })
											: img.preview
									}
									alt=""
									className="size-full object-cover"
								/>
								{img.status === "uploading" && (
									<div className="absolute inset-x-0 bottom-0 h-1 bg-secondary">
										<div
											className="h-full bg-primary transition-[width]"
											style={{ width: `${img.progress}%` }}
										/>
									</div>
								)}
								{img.status === "error" && (
									<div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/80 text-white">
										<AlertCircle className="size-4" />
										<span className="text-[10px]">上传失败</span>
									</div>
								)}
								<button
									type="button"
									onClick={() => removeImage(img.id)}
									aria-label="移除图片"
									className="absolute top-1 right-1 inline-flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
								>
									<X className="size-3" />
								</button>
							</div>
						))}
					</div>
				)}
				{quotedTweet && (
					<div className="relative mt-3 rounded-lg border border-edge-hairline bg-surface/50 p-3 text-xs">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5 font-medium text-foreground">
								<span>{quotedTweet.author.username}</span>
								<span className="text-muted-foreground font-normal">
									·{" "}
									{formatDistanceToNow(new Date(quotedTweet.created_at), {
										addSuffix: true,
										locale: zhCN,
									})}
								</span>
							</div>
							{onCancelQuote && (
								<button
									type="button"
									onClick={onCancelQuote}
									className="text-muted-foreground hover:text-foreground"
									title="取消引用"
								>
									<X className="size-3.5" />
								</button>
							)}
						</div>
						{quotedTweet.content && (
							<p className="mt-1 line-clamp-2 text-foreground/90 whitespace-pre-wrap">
								{quotedTweet.content}
							</p>
						)}
						{quotedTweet.images && quotedTweet.images.length > 0 && (
							<div className="mt-1.5 text-muted-foreground">
								[{quotedTweet.images.length} 张图片]
							</div>
						)}
					</div>
				)}

				<div className="mt-3 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<input
							ref={inputRef}
							type="file"
							accept="image/*"
							multiple
							className="hidden"
							onChange={(e) => handleFiles(e.target.files)}
						/>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-8"
							onClick={() => inputRef.current?.click()}
							disabled={images.length >= MAX_TWEET_IMAGES || uploading}
							aria-label="添加图片"
							title={`图片 ${images.length}/${MAX_TWEET_IMAGES}`}
						>
							<ImagePlus className="size-4" />
						</Button>
						<EmojiPicker
							onSelect={handleEmojiSelect}
							align="start"
							closeOnSelect={false}
							trigger={
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-8 text-muted-foreground hover:text-foreground"
									aria-label="添加表情"
									title="添加表情"
								>
									<Smile className="size-4" />
								</Button>
							}
						/>
						<span
							className={
								overLimit
									? "text-xs font-medium text-destructive"
									: "text-xs text-muted-foreground"
							}
						>
							{remaining}
						</span>
					</div>
					<Button type="submit" size="sm" disabled={!canSubmit}>
						{createTweet.isPending ? (
							<Loader2 className="size-3.5 animate-spin" />
						) : (
							<Send className="size-3.5" />
						)}
						发布
					</Button>
				</div>
			</div>
		</form>
	);
}

export default TweetComposer;

/** 错误 → toast：把 ApiError 的 message 暴露给用户 */
function toastError(err: unknown, fallback: string) {
	toast.error(err instanceof ApiError ? err.message : fallback);
}
