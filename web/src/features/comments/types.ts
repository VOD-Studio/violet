/**
 * 评论功能类型定义
 */

/** 评论数据结构 */
export interface Comment {
  id: string;
  author_name: string;
  author_email?: string;
  body: string;
  created_at: string;
  children?: Comment[];
}

/** 提交评论的数据结构（后端使用 snake_case） */
export interface CommentSubmitData {
  author_name: string;
  author_email?: string;
  author_url?: string;
  body: string;
  parent_id?: string;
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
