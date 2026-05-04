// 评论区组件
// 展示评论列表（嵌套展示）和评论表单
// 支持提交评论、回复评论和加载状态
// 已登录用户自动填充用户名和邮箱
// 监测评论区进入视口状态并更新 store

import { useState, useEffect, useRef, useMemo } from "react";
import { usePostStore } from "@/store";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { CommentReactionsProvider } from "../contexts/CommentReactionsContext";
import { useCommentReactionsBatch } from "../hooks/useCommentReactionsBatch";
import { useComments } from "../api";
import type { Comment } from "../types";

interface CommentSectionProps {
  /** 文章 ID */
  postId: string;
}

/**
 * 递归收集所有评论 ID（包括嵌套回复）
 */
function collectCommentIds(comments: Comment[]): string[] {
  const ids: string[] = [];

  function traverse(comment: Comment) {
    ids.push(comment.id);
    if (comment.children && comment.children.length > 0) {
      comment.children.forEach(traverse);
    }
  }

  comments.forEach(traverse);
  return ids;
}

/**
 * 评论区组件
 * 包含评论列表展示和评论提交表单
 */
export function CommentSection({ postId }: CommentSectionProps) {
  const { data: comments, isLoading } = useComments(postId);
  const sectionRef = useRef<HTMLElement>(null);
  const { setHasReachedComments } = usePostStore();

  // 回复状态
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    authorName: string;
  } | null>(null);

  // 收集所有评论 ID 用于批量查询
  const commentIds = useMemo(() => {
    if (!comments || comments.length === 0) return [];
    return collectCommentIds(comments);
  }, [comments]);

  // 批量查询所有评论的反应数据
  const { data: reactionsMap = {}, isLoading: isLoadingReactions } =
    useCommentReactionsBatch(commentIds);

  // 监测评论区是否进入视口，更新 store 状态
  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      // 评论区顶部距离视口底部还有一定距离时，认为已到达
      setHasReachedComments(rect.top <= window.innerHeight + 200);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [setHasReachedComments]);

  /**
   * 触发回复
   */
  const handleReply = (commentId: string, authorName: string) => {
    setReplyingTo({ commentId, authorName });
  };

  /**
   * 取消回复
   */
  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  return (
    <section ref={sectionRef} className="mt-16 border-t pt-8">
      <h2 className="mb-6 text-xl font-bold">评论</h2>

      {/* 评论列表 */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          加载评论中...
        </div>
      ) : (comments ?? []).length > 0 ? (
        <CommentReactionsProvider
          reactionsMap={reactionsMap}
          isLoading={isLoadingReactions}
        >
          <div className="mb-8 space-y-6">
            {(comments ?? []).map((comment: Comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                postId={postId}
                replyingTo={replyingTo?.commentId}
                onReply={handleReply}
                onCancelReply={handleCancelReply}
              />
            ))}
          </div>
        </CommentReactionsProvider>
      ) : (
        <div className="mb-8 rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          暂无评论，来发表第一条评论吧
        </div>
      )}

      {/* 主评论表单 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">发表评论</h3>
        <CommentForm postId={postId} />
      </div>
    </section>
  );
}
