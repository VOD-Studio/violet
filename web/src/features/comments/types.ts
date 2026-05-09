/**
 * 评论功能类型定义
 */

/** 评论图片信息 */
export interface CommentPicture {
  /** 图片 URL */
  url: string;
  /** 缩略图 URL */
  thumbnail: string;
  /** 图片宽度 */
  width: number;
  /** 图片高度 */
  height: number;
  /** 图片大小（字节） */
  size: number;
}

/** 评论表情信息 */
export interface CommentEmote {
  /** 表情 ID */
  id: number;
  /** 表情文本 */
  text: string;
  /** 表情图片 URL */
  url: string;
  /** GIF 动图 URL */
  gif_url?: string;
}

/** 评论内容结构 */
export interface CommentContent {
  /** 评论文本 */
  message: string;
  /** 表情映射表 */
  emote: Record<string, CommentEmote>;
  /** 图片列表 */
  pictures?: CommentPicture[];
}

/** 评论数据结构 */
export interface Comment {
  /** 评论 ID */
  id: string;
  /** 作者名称 */
  author_name: string;
  /** 作者邮箱 */
  author_email?: string;
  /** 评论内容 */
  content: CommentContent;
  /** 创建时间 */
  created_at: string;
  /** 表情反应列表 */
  reactions?: CommentReaction[];
  /** 子评论列表 */
  children?: Comment[];
}

/** 提交评论的数据结构（后端使用 snake_case） */
export interface CommentSubmitData {
  /** 作者名称 */
  author_name: string;
  /** 作者邮箱 */
  author_email?: string;
  /** 作者 URL */
  author_url?: string;
  /** 评论内容 */
  body: string;
  /** 父评论 ID */
  parent_id?: string;
  /** 图片 ID 列表 */
  picture_ids?: string[];
}

/** 表情反应统计 */
export interface CommentReaction {
  /** 表情 ID */
  emoji_id: number;
  /** 表情名称 */
  emoji_name: string;
  /** 表情图片 URL */
  emoji_url?: string;
  /** 表情 GIF URL */
  emoji_gif_url?: string;
  /** 文本内容 */
  text_content?: string;
  /** 反应数量 */
  count: number;
  /** 当前用户是否已反应 */
  user_reacted: boolean;
}

/** 带反应的评论 */
export interface CommentWithReactions extends Comment {
  /** 表情反应列表 */
  reactions?: CommentReaction[];
}
