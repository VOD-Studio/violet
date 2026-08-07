/**
 * Tweet 系列 - 推文领域读模型
 *
 * 对接后端 application/tweet TweetDTO（GET /api/v1/tweets 等），
 * 跨 feature 复用（全局时间线 / 详情页 / 用户主页）故归 entities 层，
 * 放置惯例对齐 entities/post、entities/comment。
 *
 * 字段 snake_case 与后端 json tag 一一对应，避免映射层。
 */

/**
 * TweetAuthor - 推文作者资料卡
 *
 * 对应后端 application/tweet AuthorDTO（toDTOs 按 authorID 批量 join users 填充）。
 */
export interface TweetAuthor {
	/** 作者用户 ID */
	id: string;
	/** 用户名 */
	username: string;
	/** 头像 URL，可能为空（渲染层经 avatarUrl 走首字母兜底） */
	avatar_url: string;
}

/**
 * Tweet - 推文读模型
 *
 * 对应后端 application/tweet/service.go 的 TweetDTO。
 */
export interface Tweet {
	/** 推文 ID */
	id: string;
	/** 作者资料卡 */
	author: TweetAuthor;
	/** 正文，≤500 rune；纯图推文为空串 */
	content: string;
	/** 图片 URL 列表（/uploads/...），≤4 张；纯文本推文为空数组 */
	images: string[];
	/** 赞数（冗余计数，列表页性能用；点赞数据源见 tweet_likes） */
	like_count: number;
	/** 创建时间，RFC3339 字符串 */
	created_at: string;
}
