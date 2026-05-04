// 评论管理类型定义

/** 评论图片信息 */
export interface CommentPicture {
  url: string;
  width: number;
  height: number;
  size: number;
}

/** 评论表情信息 */
export interface CommentEmote {
  id: number;
  text: string;
  url: string;
}

/** 评论内容结构 */
export interface CommentContent {
  message: string;
  emote: Record<string, CommentEmote>;
  pictures?: CommentPicture[];
}

/** 评论结构 */
export interface ApiComment {
  /** 评论唯一标识 */
  id: string;
  /** 所属文章 ID */
  post_id: string;
  /** 父评论 ID */
  parent_id?: string;
  /** 评论者昵称 */
  author_name: string;
  /** 评论者邮箱 */
  author_email?: string;
  /** 评论者网站 */
  author_url?: string;
  /** 评论者头像 */
  avatar_url?: string;
  /** 评论内容 */
  content: CommentContent;
  /** 评论状态 */
  status: "pending" | "approved" | "spam";
  /** 创建时间 */
  created_at: string;
  /** 子评论列表 */
  children?: ApiComment[];
}
