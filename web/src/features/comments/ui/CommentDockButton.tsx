import { MessageSquare } from "lucide-react";

/** 阅读区域的评论入口配置。 */
export interface CommentDockButtonProps {
	onClick: () => void;
	/** menu 用于目录菜单；fab 用于没有侧栏时的浮动入口。 */
	variant: "menu" | "fab";
}

/** 点击就地打开评论抽屉，不离开当前阅读位置。 */
export function CommentDockButton({ onClick, variant }: CommentDockButtonProps) {
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
