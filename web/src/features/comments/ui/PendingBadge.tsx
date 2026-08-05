/**
 * PendingBadge - 「审批中」徽章
 *
 * 仅在评论 status === 'pending' 时渲染。
 * 登录提交者本人能看到自己刚提交的 pending 评论（带此徽章）；
 * 他人永远只看到 approved（后端 ListByPost 黑洞/可见性保证），不会看到此徽章。
 *
 * PRD-0001「审批与状态可见性」。
 */
import { Clock } from "lucide-react";

export interface PendingBadgeProps {
	/** 是否显示（通常为 status === 'pending'） */
	show: boolean;
}

export function PendingBadge({ show }: PendingBadgeProps) {
	if (!show) return null;
	return (
		<span
			className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400"
			title="管理员审核通过后公开"
		>
			<Clock className="size-3" />
			审批中
		</span>
	);
}

export default PendingBadge;
