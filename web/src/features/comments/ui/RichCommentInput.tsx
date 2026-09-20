/**
 * RichCommentInput - 自包含富文本评论输入组件
 *
 * contentEditable 输入区 + 底部工具栏（emoji 按钮 + 图片上传按钮）。
 * layout="inline" 时图标与编辑区同行渲染为圆角药丸容器（聊天场景）；默认 "stacked" 保持编辑区在上、工具栏在下。
 *
 * 受控 API：value/onChange 管理纯文本内容（emoji 为 [name] 占位符）。
 * 图片上传：点击按钮 → 系统文件选择器 → useChunkedUpload 后台上传 → 缩略图进度条
 * （inlineImages=true 时改为在光标处插入行内节点，见 uploadFilesList 与 insertImage 联动）。
 * onImagesChange 回调通知父组件已上传图片列表（供提交时读取）；inlineImages 模式下
 * 按图片在文字流中的位置排序，而非上传发起顺序。
 * onUploadingChange 回调通知父组件上传状态（供禁用提交按钮）。
 * mentionCandidates 非空时输入 `@` 触发提及候选浮层（成员列表由消费方给全量，筛选在本组件内做）。
 * resetNonce 变化时清空内部图片状态（供提交成功后重置）。
 */
import { toEmojiToken } from "@entities/emoji/model/token";
import type { Emoji } from "@entities/emoji/model/types";
import { EmojiPicker } from "@features/emojis/ui/EmojiPicker";
import { useChunkedUpload } from "@features/upload/hooks/use-chunked-upload";
import {
	createImageUploadTask,
	type ImageUploadReference,
	type ImageUploadTask,
} from "@shared/lib/image-upload-task";
import { isImageURL } from "@shared/lib/url";
import { Image as ImageIcon, Smile, X } from "lucide-react";
import {
	type ReactNode,
	type Ref,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { cn } from "@/shared/lib/utils";
import {
	extractImageIds,
	type ImageNodeStatus,
	useRichTextInput,
} from "../hooks/use-rich-text-input";
import { type MentionCandidate, MentionSuggestions } from "./MentionSuggestions";

/** 候选浮层最多展示的候选数：超出部分靠继续输入收窄，不指望滚动翻找。 */
const mentionSuggestionLimit = 8;

export interface PictureInput {
	id?: string;
	url: string;
	width: number;
	height: number;
	size: number;
}

/** 供外部交互向输入区追加提及。 */
export interface RichCommentInputHandle {
	/** 在草稿末尾追加候选内用户并聚焦；禁用或用户不在候选内时返回 false。 */
	appendMention: (userID: string) => boolean;
}

export interface RichCommentInputProps {
	ref?: Ref<RichCommentInputHandle>;
	value: string;
	onChange: (value: string) => void;
	onSubmit?: () => void;
	maxImages?: number;
	enableEmoji?: boolean;
	enableImage?: boolean;
	/** 图片是否作为行内节点插入光标处、与文字混排（默认 false：图片走独立缩略图行）。仅 chat 消费。 */
	inlineImages?: boolean;
	/** 布局模式：stacked=编辑区在上、工具栏在下（默认，评论/推文场景）；inline=图标与编辑区同行的圆角药丸容器（聊天场景） */
	layout?: "stacked" | "inline";
	/** 分片上传 purpose，默认 "comment" */
	uploadPurpose?: string;
	/** 是否按 Enter 发送（Shift+Enter 换行） */
	submitOnEnter?: boolean;
	compact?: boolean;
	disabled?: boolean;
	autoFocus?: boolean;
	/** 编辑场景预填的已上传图片：以 done 态播种进内部图片状态，参与 onImagesChange 上报与占位符还原 */
	initialImages?: PictureInput[];
	placeholder?: string;
	resetNonce?: number;
	onImagesChange?: (images: PictureInput[]) => void;
	/** 上报全部上传并在正文中保留本地占位符；提交方须 retain 后再清空输入框。 */
	onImageUploadsChange?: (images: ImageUploadReference[]) => void;
	onUploadingChange?: (uploading: boolean) => void;
	/** @ 提及候选（全量成员，筛选在组件内做）；缺省或空数组时不启用提及 */
	mentionCandidates?: MentionCandidate[];
	toolbarEnd?: ReactNode;
	className?: string;
	inputClassName?: string;
}

interface ImageItem {
	id: string;
	previewUrl: string;
	progress: number;
	status: ImageNodeStatus;
	data?: PictureInput;
	task?: ImageUploadTask;
	release?: () => void;
}

export function RichCommentInput({
	ref,
	value,
	onChange,
	onSubmit,
	maxImages = 10,
	enableEmoji = true,
	enableImage = false,
	inlineImages = false,
	layout = "stacked",
	uploadPurpose = "comment",
	submitOnEnter = false,
	compact = false,
	disabled = false,
	autoFocus = false,
	initialImages,
	placeholder = "写下你的评论…",
	resetNonce = 0,
	onImagesChange,
	onImageUploadsChange,
	onUploadingChange,
	mentionCandidates,
	toolbarEnd,
	className,
	inputClassName,
}: RichCommentInputProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { uploadFile } = useChunkedUpload({ purpose: uploadPurpose });
	const [imageItems, setImageItems] = useState<ImageItem[]>(() =>
		(initialImages ?? [])
			.filter((img): img is PictureInput & { id: string } => !!img.id)
			.map((img) => ({
				id: img.id,
				previewUrl: img.url,
				progress: 100,
				status: "done" as const,
				data: img,
			})),
	);
	const imageItemsRef = useRef<ImageItem[]>(imageItems);
	imageItemsRef.current = imageItems;
	useEffect(
		() => () => {
			for (const item of imageItemsRef.current) item.release?.();
		},
		[],
	);

	// insertImage 来自下方 useRichTextInput，而 useRichTextInput 又需要引用本函数（onPasteFiles）
	// 构造 uploadFilesList——用 ref 打破这个循环依赖，本函数只在异步回调里读取，不影响其 deps。
	const insertImageRef = useRef<
		((id: string, url: string, status: ImageNodeStatus, replaceId?: string) => void) | null
	>(null);

	const uploadFilesList = useCallback(
		async (files: File[]) => {
			if (!enableImage || disabled || files.length === 0) return;
			const remaining = maxImages - imageItemsRef.current.length;
			if (remaining <= 0) return;
			const toUpload = files.slice(0, remaining);

			const newItems: ImageItem[] = toUpload.map((file) => {
				const task = createImageUploadTask(file, async (source, report) => {
					const result = await uploadFile(source, (progress) => report(progress.percent));
					return {
						id: result.file_id,
						url: result.url,
						width: result.width ?? 0,
						height: result.height ?? 0,
						size: source.size,
					};
				});
				return {
					id: crypto.randomUUID(),
					previewUrl: task.previewURL,
					progress: 0,
					status: "uploading",
					task,
					release: task.retain(),
				};
			});

			setImageItems((prev) => [...prev, ...newItems]);
			if (inlineImages) {
				for (const item of newItems) {
					insertImageRef.current?.(item.id, item.previewUrl, "uploading");
				}
			}

			for (let i = 0; i < toUpload.length; i++) {
				const task = newItems[i].task;
				if (!task) continue;
				const itemId = newItems[i].id;

				try {
					const result = await task.upload((progress) => {
						setImageItems((prev) =>
							prev.map((item) => (item.id === itemId ? { ...item, progress } : item)),
						);
					});

					// 上传完成前节点可能已被用户退格删除（imageItemsRef 已剔除），此时不再原地回填。
					if (!imageItemsRef.current.some((item) => item.id === itemId)) continue;

					setImageItems((prev) =>
						prev.map((item) =>
							item.id === itemId
								? {
										...item,
										// 换键为服务端 file_id：value 占位符即媒体 id，提交内容可直接解析
										id: result.id,
										status: "done" as const,
										progress: 100,
										data: {
											id: result.id,
											url: result.url,
											width: result.width ?? 0,
											height: result.height ?? 0,
											size: task.file.size,
										},
									}
								: item,
						),
					);
					if (inlineImages)
						insertImageRef.current?.(result.id, result.url, "done", itemId);
				} catch {
					if (!imageItemsRef.current.some((item) => item.id === itemId)) continue;
					setImageItems((prev) =>
						prev.map((item) =>
							item.id === itemId ? { ...item, status: "error" as const } : item,
						),
					);
					if (inlineImages) insertImageRef.current?.(itemId, "", "error");
				}
			}
		},
		[disabled, enableImage, inlineImages, maxImages, uploadFile],
	);

	const handleRemoveImage = useCallback((id: string) => {
		setImageItems((prev) => {
			const item = prev.find((i) => i.id === id);
			if (item) item.release?.();
			return prev.filter((i) => i.id !== id);
		});
	}, []);

	const resolveImage = useCallback(
		(id: string) => imageItemsRef.current.find((item) => item.id === id)?.data?.url,
		[],
	);

	const mentionEnabled = !!mentionCandidates?.length;
	const [mentionQuery, setMentionQuery] = useState<string | null>(null);
	const [mentionIndex, setMentionIndex] = useState(0);
	const resolveMention = useCallback(
		(userID: string) => mentionCandidates?.find((item) => item.id === userID)?.displayName,
		[mentionCandidates],
	);
	// 查询词一变候选列表就变，高亮回到第一项；方向键改高亮时不触发 input，下标得以保留。
	const handleMentionQueryChange = useCallback((query: string | null) => {
		setMentionQuery(query);
		setMentionIndex(0);
	}, []);

	const {
		contentRef,
		focus,
		insertEmoji,
		insertImage,
		insertMention,
		handleInput,
		handlePaste,
		handleKeyDown,
	} = useRichTextInput({
		value,
		onChange,
		onSubmit,
		disabled,
		submitOnEnter,
		includePendingImages: Boolean(onImageUploadsChange),
		onPasteFiles: enableImage ? uploadFilesList : undefined,
		resolveImage: inlineImages ? resolveImage : undefined,
		onImageRemove: inlineImages ? handleRemoveImage : undefined,
		resolveMention: mentionEnabled ? resolveMention : undefined,
		onMentionQueryChange: mentionEnabled ? handleMentionQueryChange : undefined,
	});
	insertImageRef.current = insertImage;
	useImperativeHandle(
		ref,
		() => ({
			appendMention(userID) {
				const candidate = mentionCandidates?.find((item) => item.id === userID);
				if (disabled || !candidate) return false;
				focus();
				insertMention(candidate.id, candidate.username, candidate.displayName);
				return true;
			},
		}),
		[disabled, focus, insertMention, mentionCandidates],
	);

	const mentionMatches = useMemo(() => {
		if (mentionQuery === null || !mentionCandidates?.length) return [];
		const query = mentionQuery.trim().toLowerCase();
		const matched = query
			? mentionCandidates.filter(
					(item) =>
						item.username.toLowerCase().includes(query) ||
						item.displayName.toLowerCase().includes(query),
				)
			: mentionCandidates;
		return matched.slice(0, mentionSuggestionLimit);
	}, [mentionCandidates, mentionQuery]);

	const selectMention = (candidate: MentionCandidate) => {
		insertMention(candidate.id, candidate.username, candidate.displayName);
		setMentionQuery(null);
	};

	/** 提及浮层优先吃掉方向键/回车/Esc；返回 true 表示按键已被消费，不再交给编辑区。 */
	const handleMentionKeyDown = (event: React.KeyboardEvent): boolean => {
		if (event.nativeEvent.isComposing || mentionMatches.length === 0) return false;
		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				setMentionIndex((index) => (index + 1) % mentionMatches.length);
				return true;
			case "ArrowUp":
				event.preventDefault();
				setMentionIndex(
					(index) => (index - 1 + mentionMatches.length) % mentionMatches.length,
				);
				return true;
			case "Enter":
			case "Tab":
				event.preventDefault();
				selectMention(mentionMatches[mentionIndex] ?? mentionMatches[0]);
				return true;
			case "Escape":
				event.preventDefault();
				// 聊天 composer 的祖先监听 Esc 取消回复/分享，浮层开着时这一层先兜住。
				event.stopPropagation();
				setMentionQuery(null);
				return true;
			default:
				return false;
		}
	};

	useEffect(() => {
		if (autoFocus && !disabled) focus();
	}, [autoFocus, disabled, focus]);

	useEffect(() => {
		if (!inlineImages) {
			const completed = imageItems.filter(
				(i): i is ImageItem & { data: PictureInput } => i.status === "done" && !!i.data,
			);
			onImagesChange?.(completed.map((i) => i.data));
			return;
		}
		// inlineImages：按图片在文字流中的位置排序（而非上传发起顺序）输出。
		const byId = new Map(imageItems.map((item) => [item.id, item] as const));
		const ordered = extractImageIds(value)
			.map((id) => byId.get(id))
			.filter(
				(item): item is ImageItem & { data: PictureInput } =>
					!!item && item.status === "done" && !!item.data,
			);
		onImagesChange?.(ordered.map((item) => item.data));
	}, [imageItems, inlineImages, onImagesChange, value]);

	useEffect(() => {
		if (!onImageUploadsChange) return;
		const ids = inlineImages ? extractImageIds(value) : imageItems.map((item) => item.id);
		const byId = new Map(imageItems.map((item) => [item.id, item]));
		onImageUploadsChange(
			[...new Set(ids)].flatMap((id) => {
				const item = byId.get(id);
				return item?.task ? [{ id, task: item.task }] : [];
			}),
		);
	}, [imageItems, inlineImages, value, onImageUploadsChange]);

	useEffect(() => {
		onUploadingChange?.(imageItems.some((i) => i.status === "uploading"));
	}, [imageItems, onUploadingChange]);

	// inlineImages：contentEditable 里的图片节点被退格删掉后，value 中不再含对应
	// `![img:id]` 占位符——同步剔除本地跟踪状态，避免残留 blob 预览 URL 与幽灵引用。
	useEffect(() => {
		if (!inlineImages) return;
		const survivingIds = new Set(extractImageIds(value));
		setImageItems((prev) => {
			const next = prev.filter((item) => survivingIds.has(item.id));
			if (next.length === prev.length) return prev;
			for (const item of prev) {
				if (!survivingIds.has(item.id)) item.release?.();
			}
			return next;
		});
	}, [inlineImages, value]);

	// Reset images when resetNonce changes (e.g., after form submit)
	const prevNonceRef = useRef(resetNonce);
	useEffect(() => {
		if (resetNonce !== prevNonceRef.current) {
			prevNonceRef.current = resetNonce;
			setImageItems((prev) => {
				prev.forEach((i) => {
					i.release?.();
				});
				return [];
			});
		}
	}, [resetNonce]);

	const handleEmojiSelect = (emoji: Emoji) => {
		const imageUrl = emoji.gif_url || emoji.url;
		const size = emoji.meta?.size;
		const token = toEmojiToken(emoji);
		if (imageUrl && isImageURL(imageUrl)) {
			insertEmoji(token, imageUrl, size);
		} else {
			insertEmoji(token, emoji.text_content || emoji.name, size);
		}
	};

	const handleFileSelect = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(e.target.files ?? []);
			e.target.value = "";
			await uploadFilesList(files);
		},
		[uploadFilesList],
	);

	const canAddMore = imageItems.length < maxImages && !disabled;
	const isInline = layout === "inline";

	const emojiButton = enableEmoji && (
		<EmojiPicker
			onSelect={handleEmojiSelect}
			align="start"
			closeOnSelect={false}
			trigger={
				isInline ? (
					<button
						type="button"
						aria-label="添加表情"
						className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						<Smile className="size-4" />
					</button>
				) : undefined
			}
		/>
	);

	const imageButton = enableImage && (
		<button
			type="button"
			onClick={() => fileInputRef.current?.click()}
			disabled={!canAddMore}
			title={canAddMore ? "上传图片" : `最多 ${maxImages} 张图片`}
			className={cn(
				"inline-flex items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40",
				isInline ? "size-9 rounded-full" : "size-7 rounded",
			)}
		>
			<ImageIcon className={isInline ? "size-4" : "size-3.5"} />
		</button>
	);

	const editor = (
		<div
			ref={contentRef}
			contentEditable={!disabled}
			onInput={handleInput}
			onPaste={handlePaste}
			onKeyDown={(event) => {
				if (handleMentionKeyDown(event)) return;
				handleKeyDown(event);
			}}
			onBlur={() => setMentionQuery(null)}
			data-placeholder={placeholder}
			role="textbox"
			aria-multiline="true"
			aria-label="评论内容"
			tabIndex={0}
			suppressContentEditableWarning
			className={cn(
				"overflow-y-auto bg-transparent focus:outline-none",
				isInline
					? "min-h-9 max-h-40 flex-1 min-w-0 px-1 py-1.5 text-sm leading-relaxed"
					: "max-h-60",
				!isInline &&
					(compact ? "min-h-10 px-3 py-2 text-sm" : "min-h-24 px-4 py-3 text-sm"),
				"empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
				inputClassName,
			)}
		/>
	);

	// 非 inlineImages 模式下图片走独立缩略图行，与输入区合并为一张卡片（无分隔线）
	const thumbnails = !inlineImages && imageItems.length > 0 && (
		<div className="flex flex-wrap gap-2 px-3 py-2">
			{imageItems.map((item) => (
				<div
					key={item.id}
					className="group relative size-20 overflow-hidden rounded border border-edge-hairline"
				>
					<img src={item.previewUrl} alt="" className="size-full object-cover" />
					{item.status === "uploading" && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/40">
							<span className="text-xs font-medium text-white">{item.progress}%</span>
						</div>
					)}
					{item.status === "error" && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/60">
							<span className="text-xs text-white">失败</span>
						</div>
					)}
					{!disabled && (
						<button
							type="button"
							onClick={() => handleRemoveImage(item.id)}
							className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
							aria-label="删除图片"
						>
							<X className="size-3" />
						</button>
					)}
				</div>
			))}
		</div>
	);

	const fileInput = (
		<input
			ref={fileInputRef}
			type="file"
			accept="image/*"
			multiple
			className="hidden"
			onChange={handleFileSelect}
		/>
	);
	const suggestions = mentionMatches.length > 0 && (
		<MentionSuggestions
			activeIndex={mentionIndex}
			candidates={mentionMatches}
			onActiveIndexChange={setMentionIndex}
			onSelect={selectMention}
		/>
	);

	if (isInline) {
		return (
			<div
				className={cn(
					"relative rounded-3xl border border-edge-hairline bg-background px-2 py-1.5",
					"focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20",
					"transition-all",
					disabled && "opacity-50",
					className,
				)}
			>
				{suggestions}
				{fileInput}
				{thumbnails}
				<div className="flex items-center gap-1">
					<div className="flex shrink-0 items-center gap-0.5">
						{emojiButton}
						{imageButton}
					</div>
					{editor}
					<div className="shrink-0">{toolbarEnd}</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"relative rounded-lg border border-edge-hairline bg-background",
				"focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20",
				"transition-all",
				disabled && "opacity-50",
				className,
			)}
		>
			{suggestions}
			{fileInput}
			{editor}
			{thumbnails}
			<div className="flex items-center justify-between border-t border-edge-hairline px-2 py-1">
				<div className="flex items-center gap-1">
					{emojiButton}
					{imageButton}
				</div>
				{toolbarEnd}
			</div>
		</div>
	);
}
