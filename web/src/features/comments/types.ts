/**
 * 评论功能类型定义
 */

/** 评论数据结构 */
export interface Comment {
  id: string;
  author_name: string;
  author_email?: string;
  body_html: string;
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
