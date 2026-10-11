import { Loader2, Send, X } from "lucide-react";
import { RichCommentInput } from "./RichCommentInput";

export interface AnnotationComposerProps {
	/** 面板标题，如「划线批注」「段评」 */
	title: string;
	/** 引言：被批注的原文，最多显示两行 */
	quote: string;
	body: string;
	onBodyChange: (value: string) => void;
	onSubmit: () => void;
	onCancel: () => void;
	pending: boolean;
	placeholder?: string;
}

/** 批注输入面板：引言 + 富文本输入 + 提交/取消，划线批注与段评共用。 */
export function AnnotationComposer({
	title,
	quote,
	body,
	onBodyChange,
	onSubmit,
	onCancel,
	pending,
	placeholder = "写下你的批注…",
}: AnnotationComposerProps) {
	return (
		<div className="w-80 rounded-2xl border border-edge-hairline bg-surface-glass p-3 shadow-lg backdrop-blur">
			<div className="mb-2 flex items-center justify-between">
				<span className="text-xs font-medium text-muted-foreground">{title}</span>
				<button
					type="button"
					onClick={onCancel}
					className="text-muted-foreground hover:text-foreground"
					aria-label="取消"
				>
					<X className="size-3.5" />
				</button>
			</div>
			<blockquote className="mb-2 line-clamp-2 border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground">
				{quote}
			</blockquote>
			<RichCommentInput
				value={body}
				onChange={onBodyChange}
				onSubmit={onSubmit}
				compact
				enableEmoji
				enableImage={false}
				disabled={pending}
				placeholder={placeholder}
				toolbarEnd={
					<button
						type="button"
						onClick={onSubmit}
						disabled={pending || !body.trim()}
						title="提交批注"
						aria-label="提交批注"
						className="inline-flex size-7 items-center justify-center rounded bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{pending ? (
							<Loader2 className="size-3.5 animate-spin" />
						) : (
							<Send className="size-3.5" />
						)}
					</button>
				}
			/>
		</div>
	);
}
