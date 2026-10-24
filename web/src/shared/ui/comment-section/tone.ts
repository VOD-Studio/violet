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
		bar: "bg-decoration",
		badge: "bg-selected text-selected-foreground",
	},
	author: {
		bar: "bg-success",
		badge: "bg-success/10 text-success-text",
	},
};

/** 取色阶配置，未知值回退 default */
export function getCommentToneCfg(tone: CommentTone): CommentToneCfg {
	return COMMENT_TONES[tone] ?? COMMENT_TONES.default;
}

/** 作者标识使用品牌语义，与普通评论者的中性样式区分。 */
export const AUTHOR_TIER = {
	/** 头像外环（头像需放在 p-0.5 内层） */
	avatarRing: "rounded-full bg-decoration p-0.5",
	/** 头像右上角皇冠角标 */
	crown: "absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-decoration text-decoration-foreground ring-2 ring-background",
	/** 品牌文字色保证昵称可读。 */
	name: "font-semibold text-link",
	/** 作者徽章 */
	badge: "inline-flex items-center gap-0.5 rounded-full bg-decoration px-1.5 py-0.5 text-[10px] font-medium text-decoration-foreground",
	/** 品牌浅底保留正文对比。 */
	bubble: "bg-selected",
} as const;
