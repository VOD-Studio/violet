/**
 * comments 模块树节点类型：两层扁平楼中楼（不深嵌套）。
 *
 * buildCommentTree / getCommentSeverity 已在评论区抽离为 shared 展示层时删除
 * （free 列表按 top_level=true 拉取，无需建树；severity 由 shared tone 承担）。
 * 批注层（AnnotationLayer）仍手工组装本节点形状，类型保留。
 */
import type { Comment } from "@entities/comment/model/types";

/** CommentTreeNode 树节点：评论本体 + 扁平回复列表 */
export interface CommentTreeNode {
	comment: Comment;
	/** 顶层评论下的回复（两层扁平，不深嵌套）。
	 *  回复另一条回复时，仍挂同一顶层下，靠 comment.reply_to_name 标对话关系。 */
	replies: CommentTreeNode[];
}
