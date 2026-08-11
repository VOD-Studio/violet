/**
 * comment-section 公共评论展示层 —— 归一化模型与配置契约
 *
 * 被 features/comments（文章评论）与 features/tweets（推文评论）共用。
 * shared 层不感知后端评论形状（Comment / TweetComment 字段不同），
 * 由 feature 层通过 CommentSectionConfig.map 适配为 CommentDisplayItem。
 * 数据获取（React Query hooks）留在 feature 层，本模块纯展示。
 */

import type { ReactNode } from "react";

/** 原始评论的最小约束（归一化与去重需要 id） */
export type CommentRaw = { id: string };

/** 评论展示视觉色阶（源自文章评论 severity 概念；推文恒 default） */
export type CommentTone = "default" | "discussion" | "author";

/** 单条评论的展示归一化模型（feature 适配，shared 渲染） */
export interface CommentDisplayItem<T extends CommentRaw = CommentRaw> {
	/** 评论 ID */
	id: string;
	/** 展示层级：0=顶层评论，1=回复（两层扁平，不深嵌套） */
	depth: number;
	/** 被回复的评论 id（顶层省略） */
	parentId?: string;
	/** 回复对象昵称（「回复 @yyy」标注）。后端已填则直接读，否则由回复区按 parentId 推导 */
	replyToName?: string;
	/** 作者昵称 */
	authorName: string;
	/** 作者头像 URL；空串渲染首字母兜底 */
	authorAvatarUrl?: string;
	/** 作者主页（可选，如推文 /users/$username；文章匿名评论无主页） */
	authorHref?: string;
	/** 是否作者本人（作者徽章） */
	isAuthor?: boolean;
	/** 是否待审核（「审批中」徽章；推文即发即出恒 false） */
	isPending?: boolean;
	/** 正文纯文本 */
	body: string;
	/** 创建时间，RFC3339 字符串 */
	createdAt: string;
	/** 回复总数（后端返回才有；无则回复区走「查看回复」toggle） */
	repliesTotal?: number;
	/** 回复预览（后端返回才有；无则展开时才拉取） */
	repliesPreview?: T[];
	/** 视觉色阶 */
	tone?: CommentTone;
	/** 原始评论对象（插槽 / 回调用） */
	raw: T;
}

/** 展开回复的查询结果（feature 包装自己的 React Query hook 得到） */
export interface CommentRepliesQuery<T extends CommentRaw = CommentRaw> {
	/** 已拉取回复（pages 拍平，未去重） */
	replies: T[];
	hasNextPage: boolean;
	fetchNextPage: () => void;
	isFetchingNextPage: boolean;
	isLoading: boolean;
}

/** 回复区模式：preview=后端返回预览+总数（文章）；toggle=无预览（推文，展开才拉取） */
export type CommentRepliesMode = "preview" | "toggle";

/** 共享评论展示层的 feature 适配配置 */
export interface CommentSectionConfig<T extends CommentRaw = CommentRaw> {
	/** 原始评论 → 展示模型 */
	map: (raw: T) => CommentDisplayItem<T>;
	/** 回复区模式 */
	repliesMode: CommentRepliesMode;
	/** 展开后的回复加载器：feature 包装自己的查询 hook，展开时才挂载（懒加载） */
	renderExpandedReplies: (props: {
		topLevelId: string;
		/** 已展示的回复 id（预览 + 内联 pending），拉取结果跳过它们 */
		excludeIds: Set<string>;
		/** 已可见回复（预览 + pending），供「回复 @yyy」按 parentId 推导 */
		knownReplies: CommentDisplayItem<T>[];
		isLoggedIn: boolean;
		onReplyAdded: (reply: CommentDisplayItem<T>) => void;
	}) => ReactNode;
	/** 正文插槽（文章 EmojiText+图片；缺省渲染纯文本） */
	renderBody?: (item: CommentDisplayItem<T>) => ReactNode;
	/** 操作插槽（文章 ReactionBar；推文删除按钮） */
	renderActions?: (item: CommentDisplayItem<T>) => ReactNode;
	/** 回复表单插槽（点「回复」后内联展开；提交成功后调用 onSuccess(raw)） */
	renderReplyForm: (
		item: CommentDisplayItem<T>,
		opts: { onSuccess: (raw: T) => void },
	) => ReactNode;
}
