import { MessageSquare, X } from "lucide-react";
import { useEffect } from "react";
import { CommentSection } from "./CommentSection";
import { usePresence } from "./use-presence";

/** 与 annotations.css 中 .comment-drawer 的 transition 时长一致 */
const EXIT_MS = 200;

export interface CommentDrawerProps {
	open: boolean;
	onClose: () => void;
	/** 文章 id */
	postId: string;
}

/**
 * CommentDrawer - 文章页就地打开的评论抽屉，免去滚到页面底部。
 *
 * 内容复用文章底部的评论区（含登录引导、匿名留言、评论列表）。靠透明度与模糊淡入淡出，
 * 不位移不缩放；Esc 或点击面板外关闭。
 */
export function CommentDrawer({ open, onClose, postId }: CommentDrawerProps) {
	const { mounted, visible } = usePresence(open, EXIT_MS);

	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!mounted) return null;

	return (
		<>
			<button
				type="button"
				aria-label="关闭评论"
				tabIndex={-1}
				onClick={onClose}
				data-state={visible ? "open" : "closed"}
				className="comment-drawer-backdrop fixed inset-0 z-40 cursor-default bg-background/30"
			/>
			<aside
				role="dialog"
				aria-label="评论"
				data-state={visible ? "open" : "closed"}
				className="comment-drawer fixed top-20 right-4 bottom-4 z-50 flex w-120 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-surface-glass shadow-[0_4px_24px_rgb(0_0_0/0.05)] backdrop-blur-md dark:ring-1 dark:ring-white/10"
			>
				<button
					type="button"
					onClick={onClose}
					className="absolute top-3 right-3 z-10 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					aria-label="关闭"
				>
					<X className="size-4" />
				</button>
				<div className="annotation-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
					<CommentSection postId={postId} />
				</div>
			</aside>
		</>
	);
}

/**
 * 评论入口：点击就地打开评论抽屉。
 *
 * @param variant - menu：目录悬停菜单里阅读进度下方的一行，与进度行同款；fab：右下角浮动按钮，无侧边栏时用
 */
export function CommentDockButton({
	onClick,
	variant,
}: {
	onClick: () => void;
	variant: "menu" | "fab";
}) {
	if (variant === "fab") {
		return (
			<button
				type="button"
				onClick={onClick}
				title="查看或发表评论"
				aria-label="查看或发表评论"
				className="inline-flex size-12 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow-[0_4px_24px_rgb(0_0_0/0.05)] backdrop-blur-md transition-colors hover:text-primary"
			>
				<MessageSquare className="size-5" />
			</button>
		);
	}
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="查看或发表评论"
			className="group flex items-center gap-2.5 rounded-md text-sm text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4"
		>
			<MessageSquare className="size-5 text-primary" />
			<span>评论</span>
		</button>
	);
}
