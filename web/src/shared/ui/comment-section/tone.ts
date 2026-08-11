/**
 * 评论视觉色阶配置（单一来源）
 *
 * 从 features/comments/lib/severity.ts 提升：shared 展示层需要 bar/badge 色阶。
 * 三态语义由 feature 层计算（文章 severity / 推文恒 default），本文件只映射颜色。
 * 配色走 shadcn 友好的 Tailwind 色阶（与 announcement-severity 同构）。
 */
import type { CommentTone } from "./types";

export interface CommentToneCfg {
	/** 左侧 1px 色条 class */
	bar: string;
	/** 作者徽章 class（背景 + 前景，含 dark 变体） */
	badge: string;
}

export const COMMENT_TONES: Record<CommentTone, CommentToneCfg> = {
	default: {
		bar: "bg-slate-400",
		badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
	},
	discussion: {
		bar: "bg-blue-500",
		badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
	},
	author: {
		bar: "bg-emerald-500",
		badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
	},
};

/** 取色阶配置，未知值回退 default */
export function getCommentToneCfg(tone: CommentTone): CommentToneCfg {
	return COMMENT_TONES[tone] ?? COMMENT_TONES.default;
}
