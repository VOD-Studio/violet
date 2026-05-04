/**
 * 评论功能模块公开 API
 */

// 组件
export { CommentSection } from "./components/CommentSection";
export { CommentItem } from "./components/CommentItem";
export { CommentForm } from "./components/CommentForm";
export { RichTextInput } from "./components/RichTextInput";
export { EmojiButton } from "./components/EmojiButton";
export { EmojiPanel } from "./components/EmojiPanel";
export { EmojiItem } from "./components/EmojiItem";
export { ReactionBar } from "./components/ReactionBar";
export { ReplyIndicator } from "./components/ReplyIndicator";

// API & Hooks
export { useComments, useSubmitComment } from "./api";

// Types
export type { Comment, CommentSubmitData, CommentReaction, CommentWithReactions } from "./types";
export type { RichTextInputRef } from "./components/RichTextInput";
