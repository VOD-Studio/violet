/**
 * tweets feature 模型定义
 *
 * 跨 feature 复用的读模型归 entities/tweet；本文件放 feature 私有的
 * 查询参数、请求体与领域边界常量。
 */

import type { PictureInput } from "@features/comments/ui/RichCommentInput";

/** 正文长度上限（rune 计，对齐后端聚合根不变量 content ≤500） */
export const MAX_TWEET_LENGTH = 500;

/** 单条推文图片数量上限（对齐后端聚合根不变量 images ≤4） */
export const MAX_TWEET_IMAGES = 4;

/**
 * TweetTimelineQuery - 时间线 / 用户主页游标分页查询参数
 *
 * feed 顶部持续插入新推文，cursor 分页避免 offset 重复 / 漏数据。
 * cursor 省略表示首页。
 */
export interface TweetTimelineQuery {
	/** 上一页返回的 next_cursor；首页省略 */
	cursor?: string;
	/** 每页条数，缺省由后端补（20） */
	limit?: number;
}

/**
 * CreateTweetInput - 发推文请求体
 *
 * 对接后端 createTweetRequest { content, images }。
 * 文本与图片至少其一非空（后端聚合根兜底，前端先拦截）。
 */
export interface CreateTweetInput {
	/** 正文，≤500 rune；纯图推文可为空串 */
	content: string;
	/** 图片 URL 列表，≤4 张；纯文本推文可为空数组 */
	images: string[];
	/** 转发引用的推文 ID */
	quote_of?: string;
}

/** 评论正文长度上限（rune 计，对齐后端 MaxCommentBodyLen） */
export const MAX_TWEET_COMMENT_LENGTH = 500;

/** 顶层评论 / 回复每页条数（page/limit 分页） */
export const TWEET_COMMENT_PAGE_SIZE = 10;

/** TweetCommentPageQuery - 评论 / 回复列表分页查询参数（page/limit） */
export interface TweetCommentPageQuery {
	/** 页码，从 1 开始；首页省略 */
	page?: number;
	/** 每页条数，缺省由后端补（20） */
	limit?: number;
}

/**
 * CreateTweetCommentInput - 评论 / 回复请求体
 *
 * 对接后端 createCommentRequest { body, parent_id, pictures }。
 * parent_id 省略为顶层评论；非空为回复（两层扁平：回复一律 depth=1）。
 * pictures 可选：上传后由 RichCommentInput 回调携带，后端做归属校验。
 */
export interface CreateTweetCommentInput {
	/** 正文（纯图评论可为空串），trim 后 ≤500 rune */
	body: string;
	/** 附图（可选，url/width/height/size，≤10 张）；无图省略 */
	pictures?: PictureInput[];
	/** 被回复的评论 id；空串 / 省略为顶层评论 */
	parent_id?: string;
}
