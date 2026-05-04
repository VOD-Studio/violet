/**
 * 评论功能模块公开 API
 */

// 组件
export { CommentSection } from "./components/CommentSection";
export { CommentItem } from "./components/CommentItem";
export { EmojiPicker } from "./components/EmojiPicker";
export { EmojiPickerButton } from "./components/EmojiPickerButton";

// API & Hooks
export { useComments, useSubmitComment } from "./api";

// Types
export type { Comment, CommentSubmitData } from "./types";
