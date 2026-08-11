/**
 * comment-section - 公共评论展示层（文章评论 / 推文评论共用）
 *
 * 纯展示：数据经 CommentSectionConfig 由 feature 层注入，shared 不依赖任何 feature。
 */

export { CommentItem } from "./CommentItem";
export { CommentList } from "./CommentList";
export { CommentMeta } from "./CommentMeta";
export { CommentRepliesBlock } from "./CommentRepliesBlock";
export { CommentSection } from "./CommentSection";
export { ExpandedReplies } from "./ExpandedReplies";
export type { CommentToneCfg } from "./tone";
export { COMMENT_TONES, getCommentToneCfg } from "./tone";
export type {
	CommentDisplayItem,
	CommentRaw,
	CommentRepliesMode,
	CommentRepliesQuery,
	CommentSectionConfig,
	CommentTone,
} from "./types";
