/**
 * TweetComposer - 推文发布框（仅登录态渲染）
 *
 * 纯文本（≤500 rune）+ 最多 4 张图，文本与图片至少其一。
 * 图片复用分片上传管线（useChunkedUpload, purpose=tweet），紧凑网格预览，
 * 上传中显示进度、可移除。
 *
 * 前端先拦截边界（超 500 字 / 超 4 图 / 空内容+空图），后端聚合根再兜底。
 */

import { useChunkedUpload } from "@features/upload/hooks/use-chunked-upload";
import { ApiError } from "@shared/api/error";
import { contentImageUrl } from "@shared/lib/image-url";
import { Button } from "@shared/ui/base/button";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
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

export function TweetComposer() {
	const [content, setContent] = useState("");
	const [images, setImages] = useState<ImageItem[]>([]);
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
		(content.trim().length > 0 || doneUrls.length > 0);

	/** 选择文件 → 逐个上传（顺序，避免并发挤占分片通道） */
	const handleFiles = async (files: FileList | null) => {
		if (!files || files.length === 0) return;
		const slots = MAX_TWEET_IMAGES - images.length;
		if (slots <= 0) {
			toast.error(`最多 ${MAX_TWEET_IMAGES} 张图`);
			return;
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
			} catch (err) {
				setImages((prev) =>
					prev.map((i) => (i.id === localId ? { ...i, status: "error" } : i)),
				);
				toastError(err, "图片上传失败");
			} finally {
				URL.revokeObjectURL(preview);
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

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (overLimit) {
			toast.error(`正文不能超过 ${MAX_TWEET_LENGTH} 字`);
			return;
		}
		if (!content.trim() && doneUrls.length === 0) {
			toast.error("说点什么吧");
			return;
		}
		createTweet.mutate(
			{ content: content.trim(), images: doneUrls },
			{
				onSuccess: () => {
					setContent("");
					setImages([]);
					toast.success("已发布");
				},
				onError: (err) => toastError(err, "发布失败"),
			},
		);
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="rounded-xl border border-edge-hairline p-4"
			aria-label="发布推文"
		>
			<textarea
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
		</form>
	);
}

export default TweetComposer;

/** 错误 → toast：把 ApiError 的 message 暴露给用户 */
function toastError(err: unknown, fallback: string) {
	toast.error(err instanceof ApiError ? err.message : fallback);
}
