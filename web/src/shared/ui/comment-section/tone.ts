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

/**
 * 作者（站长）的尊贵档样式，评论区与批注气泡共用：金紫渐变头像环 + 皇冠、渐变昵称、
 * 金色徽章、淡金渐变气泡。普通评论者保持中性底色，两档一眼可辨。
 */
export const AUTHOR_TIER = {
	/** 头像外环（头像需放在 p-0.5 内层） */
	avatarRing:
		"rounded-full bg-linear-to-br from-persona-gold via-persona-gold/70 to-persona-violet p-0.5",
	/** 头像右上角皇冠角标 */
	crown: "absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-persona-gold text-white ring-2 ring-background",
	/** 昵称：金到紫的渐变字 */
	name: "bg-linear-to-r from-[oklch(0.58_0.13_70)] to-persona-violet bg-clip-text font-semibold text-transparent",
	/** 作者徽章 */
	badge: "inline-flex items-center gap-0.5 rounded-full bg-linear-to-r from-persona-gold to-persona-gold/75 px-1.5 py-0.5 text-[10px] font-medium text-white",
	/** 气泡底色 */
	bubble: "bg-linear-to-br from-persona-gold/18 via-persona-gold/6 to-persona-violet/12 shadow-[0_4px_24px_rgb(0_0_0/0.05)]",
} as const;
