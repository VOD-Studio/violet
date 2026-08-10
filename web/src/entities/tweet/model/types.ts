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
 * QuotedTweet - 被引用的推文读模型
 *
 * 对应后端 application/tweet QuotedTweetDTO。
 */
export interface QuotedTweet {
	/** 推文 ID */
	id: string;
	/** 作者资料卡 */
	author: TweetAuthor;
	/** 正文 */
	content: string;
	/** 图片 URL 列表 */
	images: string[];
	/** 引用计数 */
	quote_count: number;
	/** 创建时间，RFC3339 字符串 */
	created_at: string;
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
	/** 当前登录用户是否已点赞 */
	is_liked: boolean;
	comment_count: number;
	/** 引用计数 */
	quote_count: number;
	/** 转发引用的推文 ID */
	quote_of?: string;
	/** 被引用的推文（如果存在且未被删除） */
	quoted_tweet?: QuotedTweet;
	/** 创建时间，RFC3339 字符串 */
	created_at: string;
}

/**
 * TweetComment - 推文评论读模型
 *
 * 对应后端 application/tweet CommentDTO（GET /tweets/{id}/comments 等）。
 * 两层扁平楼中楼：depth=0 顶层评论，depth=1 回复（回复不再深嵌套）。
 * 与 comment 域楼中楼同构但更简单：纯文本、登录可发、即发即出、物理删除。
 */
export interface TweetComment {
	/** 评论 ID */
	id: string;
	/** 所属推文 ID */
	tweet_id: string;
	/** 作者资料卡（复用 TweetAuthor：推文与评论作者同构） */
	author: TweetAuthor;
	/** 正文，≤500 rune */
	body: string;
	/** 被回复的评论 id；顶层评论省略（后端 omitempty） */
	parent_id?: string;
	/** 展示层级：0=顶层评论，1=回复 */
	depth: number;
	/** 创建时间，RFC3339 字符串 */
	created_at: string;
}
