import type { Emoji } from "@entities/emoji/model/types";
import { useCreateCustomEmoji, useMyCustomEmojis } from "@features/customemoji/api/queries";
import { useUploadEmoji } from "@features/emojis/api/mutations";
import { EmojiTile } from "@features/emojis/ui/EmojiTile";
import { useFileSelection } from "@features/upload/hooks/use-file-selection";
import { Button, UploadTile } from "@violet/ui";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const MAX_EMOJI_SIZE = 10 * 1024 * 1024;
// 占位符边界与 Markdown 标记不能出现在表情名称中。
const NAME_FORBIDDEN_RE_GLOBAL = /[_*~`[\]\\]/g;

/** 个人表情的文件选择与网格；选好图片直接以文件名上传，不再单独命名确认。 */
export interface MyEmojisPanelProps {
	onSelect: (emoji: Emoji) => void;
}

/** 文件名去扩展名并剔除占位符保留字符，作为表情默认名称。 */
function defaultEmojiName(file: File): string {
	return (
		file.name
			.replace(/\.[^./]+$/, "")
			.replace(NAME_FORBIDDEN_RE_GLOBAL, "")
			.trim()
			.slice(0, 50) || "表情"
	);
}

export function MyEmojisPanel({ onSelect }: MyEmojisPanelProps) {
	const { data: mine, isLoading, isError, refetch } = useMyCustomEmojis(true);
	const uploadEmoji = useUploadEmoji();
	const createEmoji = useCreateCustomEmoji();
	const busy = uploadEmoji.isPending || createEmoji.isPending;
	const owned = mine?.owned ?? [];
	const favorited = mine?.favorited ?? [];

	const addEmoji = async (file: File) => {
		const name = defaultEmojiName(file);
		try {
			const uploaded = await uploadEmoji.mutateAsync(file);
			await createEmoji.mutateAsync({ name, url: uploaded.url });
			toast.success(`已添加表情「${name}」`);
		} catch {
			// mutation 已提示错误；无中间状态需要回滚，用户重新选择文件即可重试。
		}
	};

	const { inputProps, open } = useFileSelection({
		accept: "image/png,image/jpeg,image/gif,image/webp",
		maxSize: MAX_EMOJI_SIZE,
		maxFiles: 1,
		disabled: busy,
		onSelect: ([file]) => void addEmoji(file),
	});

	return (
		<div className="flex flex-col gap-3 pt-2">
			<input {...inputProps} aria-label="选择表情图片" className="hidden" />
			<div className="grid grid-cols-5 gap-1">
				<UploadTile
					aria-label="上传表情"
					title="上传图片，直接以文件名添加为表情"
					onClick={open}
					busy={busy}
					className="rounded-md"
				/>
				{owned.map((emoji) => (
					<EmojiTile key={emoji.custom_emoji_id} emoji={emoji} onSelect={onSelect} />
				))}
				{favorited.map((emoji) => (
					<EmojiTile key={emoji.custom_emoji_id} emoji={emoji} onSelect={onSelect} />
				))}
			</div>
			{isLoading ? (
				<div
					role="status"
					className="flex items-center justify-center py-4 text-sm text-muted-foreground"
				>
					<Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" />
					加载中…
				</div>
			) : isError && !mine ? (
				<div className="flex flex-col items-center gap-2 py-3 text-sm text-muted-foreground">
					<p>个人表情加载失败</p>
					<Button variant="outline" size="sm" onClick={() => void refetch()}>
						重新加载
					</Button>
				</div>
			) : (
				owned.length + favorited.length === 0 && (
					<p className="py-2 text-center text-xs text-muted-foreground">
						上传图片或右键收藏表情
					</p>
				)
			)}
		</div>
	);
}
