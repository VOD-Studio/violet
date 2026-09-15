/**
 * 评论视觉色阶配置（单一来源）
 *
 * 从 features/comments/lib/severity.ts 提升：shared 展示层需要 bar/badge 色阶。
 * 三态语义由 feature 层计算（文章 severity / 推文恒 default），本文件只映射颜色。
 * 走语义 token：default=中性、discussion=品牌强调、author=成功语义（作者认证）。
 */
import type { CommentTone } from "./types";

export interface CommentToneCfg {
	/** 左侧 1px 色条 class */
	bar: string;
	/** 作者徽章 class（背景 + 前景） */
	badge: string;
}

export const COMMENT_TONES: Record<CommentTone, CommentToneCfg> = {
	default: {
		bar: "bg-muted-foreground/40",
		badge: "bg-muted text-muted-foreground",
	},
	discussion: {
		bar: "bg-primary",
		badge: "bg-primary/10 text-primary",
	},
	author: {
		bar: "bg-success",
		badge: "bg-success/10 text-success",
	},
};

/** 取色阶配置，未知值回退 default */
export function getCommentToneCfg(tone: CommentTone): CommentToneCfg {
	return COMMENT_TONES[tone] ?? COMMENT_TONES.default;
}
