/**
 * 评论功能类型定义
 */

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

/** 评论数据结构 */
export interface Comment {
  id: string;
  author_name: string;
  author_email?: string;
  content: CommentContent;
  created_at: string;
  reactions?: CommentReaction[];
  children?: Comment[];
}

/** 提交评论的数据结构（后端使用 snake_case） */
export interface CommentSubmitData {
  author_name: string;
  author_email?: string;
  author_url?: string;
  body: string;
  parent_id?: string;
  pictures?: CommentPicture[];
}

/** 表情反应统计 */
export interface CommentReaction {
  emoji_id: number;
  emoji_name: string;
  emoji_url?: string;
  text_content?: string;
  count: number;
  user_reacted: boolean;
}

/** 带反应的评论 */
export interface CommentWithReactions extends Comment {
  reactions?: CommentReaction[];
}
