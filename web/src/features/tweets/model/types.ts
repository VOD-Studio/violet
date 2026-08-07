/**
 * tweets feature 模型定义
 *
 * 跨 feature 复用的读模型归 entities/tweet；本文件放 feature 私有的
 * 查询参数、请求体与领域边界常量。
 */

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
}
