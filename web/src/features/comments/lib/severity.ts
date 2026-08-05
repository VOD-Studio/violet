/**
 * 评论 severity → 视觉配置（单一来源）
 *
 * 与 announcement-severity 同构，配色走 shadcn 友好的 Tailwind 色阶（不用 neon）。
 * 三态（PRD-0001 批注热度配色）：
 *   - default：普通评论，中性色（slate）
 *   - discussion：有回复的讨论热评论，蓝色阶
 *   - author：文章 Owner 本人评论，绿色阶（最高优先级）
 *
 * 供 CommentItem / CommentList / 批注侧边栏共用，消除多套色阶的双轨。
 */
import type { CommentSeverity } from "./comment-tree";

export interface CommentSevCfg {
	/** BorderGlow 配色（HSL 三元组字符串，单色模式三值相同） */
	glow: [string, string, string];
	/** 左侧 1px 色条 class */
	bar: string;
	/** 作者徽章 class（背景 + 前景，含 dark 变体） */
	badge: string;
}

export const COMMENT_SEVERITY: Record<CommentSeverity, CommentSevCfg> = {
	default: {
		glow: ["215 16 40", "215 16 40", "215 16 40"],
		bar: "bg-slate-400",
		badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
	},
	discussion: {
		glow: ["217 91 60", "217 91 60", "217 91 60"],
		bar: "bg-blue-500",
		badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
	},
	author: {
		glow: ["152 76 40", "152 76 40", "152 76 40"],
		bar: "bg-emerald-500",
		badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
	},
};

/** 取 severity 配置，未知值回退到 default */
export function getCommentSev(severity: CommentSeverity): CommentSevCfg {
	return COMMENT_SEVERITY[severity] ?? COMMENT_SEVERITY.default;
}
