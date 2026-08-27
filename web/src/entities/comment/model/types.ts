/**
 * Comment 系列 - 评论领域实体
 *
 * 前台评论展示与后台评论管理共享的读模型，跨 feature 复用故归 entities 层，
 * 放置惯例对齐 entities/user、entities/post。
 * 原 comments/Comment 与 admin-comments/CommentDTO 字段一致，本次合并统一。
 */

/** 评论状态机 */
export type CommentStatus = "pending" | "approved" | "spam" | "deleted";

/**
 * CommentPicture - 评论附件图片
 *
 * 对应 domain/comment/entity.go 的 Picture。
 */
export interface CommentPicture {
	/** 图片 URL */
	url: string;
	/** 图片宽度，像素 */
	width: number;
	/** 图片高度，像素 */
	height: number;
	/** 图片字节数 */
	size: number;
}

/**
 * CommentAnchor - 选区批注锚点（snake_case 外部契约形态）。
 *
 * 对应后端 application/comment/service.go 的 AnchorDTO，与 features/comments/lib/types.ts
 * 的 camelCase Anchor 一一对应（snake/camel 转换在消费侧按需做）。
 * 自由评论的 anchor 为 undefined（JSON 省略）；批注非空。
 */
export interface CommentAnchor {
	/** 块标识符（块纯文本 SHA-256 前 8 位） */
	block_id: string;
	/** 选区起始偏移（块内字符位，0-based） */
	start_offset: number;
	/** 选区结束偏移（块内字符位，exclusive） */
	end_offset: number;
	/** 选中原文（fuzzy 重定位的锚） */
	selected_text: string;
	/** 块内容快照（创建时的 SHA-256 前 8 位，漂移检测用） */
	block_text_hash: string;
}

/**
 * CommentEmoteRef - 表情映射值（emote map 的 value）
 *
 * 对应后端 application/comment/service.go 的 EmojiRef。
 */
export interface CommentEmoteRef {
	/** 静态图片 URL */
	url: string;
	/** 动图 URL，可选 */
	gif_url?: string;
	/** 表情尺寸：1=小 2=大，缺省按小渲染 */
	size?: number;
	/** 自定义表情 ID；仅自定义表情 token 非空 */
	custom_emoji_id?: string;
	/** viewer 与该自定义表情的关系，决定右键菜单项；仅自定义表情非空 */
	relation?: "owned" | "favorited" | "none";
}

/**
 * Comment - 评论读模型
 *
 * 对应后端 application/comment/service.go 的 CommentDTO，
 * 前台 GET /posts/{postId}/comments 与后台待审核列表共用。
 */
export interface Comment {
	/** 评论 ID */
	id: string;
	/** 所属文章 ID */
	post_id: string;
	/** 父评论 ID，顶级评论省略 */
	parent_id?: string;
	/** 被回复者的昵称。回复节点才有，前端显示「回复 @yyy」用。
	 *  后端 toDTO 时填好，前端直接读，不自己转换。顶层评论没这个字段。 */
	reply_to_name?: string;
	/** 嵌套深度，0 为顶级 */
	depth: number;
	/** 作者昵称 */
	author_name: string;
	/** 作者头像 URL */
	avatar_url: string;
	/** 评论正文 */
	body: string;
	/** 附件图片列表，无图为空数组 */
	pictures: CommentPicture[];
	/** 表情映射表。key 为 [name]（含方括号），渲染时查表替换为 img。
	 *  body 中没有 [name] 时省略。对应后端 CommentDTO.emote。 */
	emote?: Record<string, CommentEmoteRef>;
	/** 是否由文章 Owner 本人发出（运行时 created_by==post.author_id，作者高亮用） */
	is_author: boolean;
	/** 选区批注锚点；自由评论为 undefined，批注非空 */
	anchor?: CommentAnchor;
	/** 状态 */
	status: CommentStatus;
	/** 创建时间，RFC3339 字符串 */
	created_at: string;
	/** 回复预览（前几条）。只有顶层评论有，后端 ListByPost 时填好。
	 *  「查看全部」走 GET /comments/{id}/replies 独立分页，不靠这个字段。 */
	replies?: Comment[];
	/** 该顶层评论下的回复总数。前端据此显示「查看全部 xx 条回复」。
	 *  只有顶层评论有；replies 只是预览，总数独立返回。 */
	replies_total?: number;
}

/**
 * AdminComment - 后台评论读模型，含所属文章信息
 *
 * 对应 application/comment/service.go 的 AdminCommentDTO。
 * post_id 继承自 Comment。
 */
export interface AdminComment extends Comment {
	/** 所属文章标题 */
	post_title: string;
	/** 所属文章 slug */
	post_slug: string;
}
