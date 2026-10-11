import { Loader2, LogIn, Send, X } from "lucide-react";
import type { ReactNode } from "react";
import { RichCommentInput } from "./RichCommentInput";

export interface AnnotationComposerProps {
	/** 面板标题，如「划线批注」「段评」 */
	title: string;
	/** 标题左侧的图标，显示在淡色圆角底上 */
	icon?: ReactNode;
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
	icon,
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
		<div className="annotation-pop w-104 max-w-[calc(100vw-2rem)] rounded-2xl bg-surface-glass p-4 shadow-[0_4px_24px_rgb(0_0_0/0.05)] backdrop-blur-md dark:ring-1 dark:ring-white/10">
			<div className="mb-3 flex items-center gap-2">
				{icon && (
					<span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
						{icon}
					</span>
				)}
				<span className="text-sm font-medium text-foreground">{title}</span>
				<button
					type="button"
					onClick={onCancel}
					className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
					aria-label="取消"
				>
					<X className="size-4" />
				</button>
			</div>
			<p className="relative mb-3 line-clamp-3 rounded-xl bg-muted/40 py-2 pr-3 pl-8 text-xs leading-relaxed text-muted-foreground before:absolute before:top-0.5 before:left-2.5 before:font-serif before:text-2xl before:leading-none before:text-primary/40 before:content-['“']">
				<span className="annotation-quote">{quote}</span>
			</p>
			{loginRequired ? (
				<div className="flex items-center justify-between gap-3 rounded-xl bg-primary/6 px-4 py-3">
					<span className="text-sm text-muted-foreground">登录后即可发表批注</span>
					<button
						type="button"
						onClick={onLogin}
						className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					>
						<LogIn className="size-4" />
						登录
					</button>
				</div>
			) : (
				<RichCommentInput
					value={body}
					onChange={onBodyChange}
					onSubmit={onSubmit}
					enableEmoji
					enableImage={false}
					disabled={pending}
					placeholder={placeholder}
					toolbarEnd={
						<div className="flex items-center gap-2">
							<span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
								⌘/Ctrl + Enter
							</span>
							<button
								type="button"
								onClick={onSubmit}
								disabled={pending || !body.trim()}
								title="提交批注"
								aria-label="提交批注"
								className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{pending ? (
									<Loader2 className="size-3.5 animate-spin" />
								) : (
									<Send className="size-3.5" />
								)}
								发送
							</button>
						</div>
					}
				/>
			)}
		</div>
	);
}
