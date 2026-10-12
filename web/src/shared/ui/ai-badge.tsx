/**
 * AIBadge - 「AI」身份徽章
 *
 * MCP/agent 发表的评论与批注带 is_ai=true，用此徽章与真人评论区分；
 * 头像为 Violet AI 专用形象（/logo.png），不使用 PAT 持有人的 Google/GitHub 头像。
 *
 * 文章评论（CommentMeta）与批注卡片（AnnotationCard）共用。
 */
import { Sparkles } from "lucide-react";

export interface AIBadgeProps {
	/** 是否显示（通常为 is_ai === true） */
	show: boolean;
}

export function AIBadge({ show }: AIBadgeProps) {
	if (!show) return null;
	return (
		<span
			className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
			title="由 Violet AI（MCP agent）发表"
		>
			<Sparkles className="size-3" />
			AI
		</span>
	);
}

export default AIBadge;
