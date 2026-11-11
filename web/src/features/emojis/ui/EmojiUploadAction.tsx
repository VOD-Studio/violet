import { useCreateCustomEmoji } from "@features/customemoji/api/queries";
import { useFileSelection } from "@features/upload/hooks/use-file-selection";
import { UploadTile } from "@violet/ui";
import { toast } from "sonner";
import { useUploadEmoji } from "../api/mutations";

const MAX_EMOJI_SIZE = 10 * 1024 * 1024;
// 占位符边界与 Markdown 标记不能出现在表情名称中。
const NAME_FORBIDDEN_RE_GLOBAL = /[_*~`[\]\\]/g;

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

/** 收藏页的真实文件上传入口；图片与请求状态不进入组件库。 */
export function EmojiUploadAction() {
	const uploadEmoji = useUploadEmoji();
	const createEmoji = useCreateCustomEmoji();
	const busy = uploadEmoji.isPending || createEmoji.isPending;
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
		onSelect: ([file]) => {
			if (file) {
				void addEmoji(file);
			}
		},
	});
	return (
		<>
			<input {...inputProps} aria-label="选择表情图片" className="hidden" />
			<UploadTile
				aria-label="上传表情"
				title="上传图片，直接以文件名添加为表情"
				busy={busy}
				onMouseDown={(event) => event.preventDefault()}
				onClick={open}
			/>
		</>
	);
}
