/**
 * PendingBadge - 「审批中」徽章
 *
 * 仅在评论 status === 'pending' 时渲染。
 * 登录提交者本人能看到自己刚提交的 pending 评论（带此徽章）；
 * 他人永远只看到 approved（后端黑洞/可见性保证），不会看到此徽章。
 *
 * 文章评论（CommentMeta）与批注卡片（AnnotationCard）共用。
 */
import { cn } from "cn";
import { Clock } from "lucide-react";

export interface PendingBadgeProps {
	/** 是否显示（通常为 status === 'pending'） */
	show: boolean;
	/**
	 * sm 高 16、不带图标，与署名旁的小标签并排时不压过署名。
	 *
	 * @default "md"
	 */
	size?: "sm" | "md";
}

export function PendingBadge({ show, size = "md" }: PendingBadgeProps) {
	if (!show) return null;
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full bg-warning/10 text-warning",
				size === "sm"
					? "h-4 px-1.5 text-[10.5px] font-medium"
					: "gap-1 px-2 py-0.5 text-xs",
			)}
			title="管理员审核通过后公开"
		>
			{size === "md" && <Clock className="size-3" />}
			审批中
		</span>
	);
}

export default PendingBadge;
