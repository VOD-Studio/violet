import { Loader2, LogIn, Send, X } from "lucide-react";
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
	/** 未登录：用登录入口取代输入框 */
	loginRequired?: boolean;
	onLogin?: () => void;
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
	loginRequired = false,
	onLogin,
}: AnnotationComposerProps) {
	return (
		<div className="annotation-pop w-80 rounded-2xl bg-surface-glass p-3.5 shadow-[0_4px_24px_rgb(0_0_0/0.05)] backdrop-blur-md dark:ring-1 dark:ring-white/10">
			<div className="mb-2 flex items-center justify-between">
				<span className="text-xs font-medium text-muted-foreground">{title}</span>
				<button
					type="button"
					onClick={onCancel}
					className="text-muted-foreground transition-colors hover:text-foreground"
					aria-label="取消"
				>
					<X className="size-3.5" />
				</button>
			</div>
			<p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
				<span className="annotation-quote">{quote}</span>
			</p>
			{loginRequired ? (
				<div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
					<span className="text-xs text-muted-foreground">登录后即可发表批注</span>
					<button
						type="button"
						onClick={onLogin}
						className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					>
						<LogIn className="size-3.5" />
						登录
					</button>
				</div>
			) : (
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
							className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{pending ? (
								<Loader2 className="size-3.5 animate-spin" />
							) : (
								<Send className="size-3.5" />
							)}
						</button>
					}
				/>
			)}
		</div>
	);
}
