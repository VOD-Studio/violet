// 评论区组件
// 展示评论列表（嵌套展示）和评论表单
// 支持提交评论、回复评论和加载状态
// 已登录用户自动填充用户名和邮箱
// 监测"发表评论"表单区域进入视口状态并更新 store

import { useState, useEffect, useRef } from "react";
import { usePostStore } from "@/store";
import { CommentItem } from "./CommentItem";
import { CommentForm } from "./CommentForm";
import { useComments } from "../api";
import type { Comment } from "../types";

interface CommentSectionProps {
  /** 文章 ID */
  postId: string;
}

/**
 * 评论区组件
 * 包含评论列表展示和评论提交表单
 */
export function CommentSection({ postId }: CommentSectionProps) {
  const { data: comments, isLoading } = useComments(postId);
  const formRef = useRef<HTMLDivElement>(null);
  const { setHasReachedComments } = usePostStore();

  // 回复状态
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    authorName: string;
  } | null>(null);

  // 监测"发表评论"表单区域是否进入视口，更新 store 状态
  useEffect(() => {
    const handleScroll = () => {
      if (!formRef.current) return;
      const rect = formRef.current.getBoundingClientRect();
      // 表单区域顶部进入视口时，认为已到达
      setHasReachedComments(rect.top <= window.innerHeight);
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
    <section className="mt-16 border-t pt-8">
      <h2 className="mb-6 text-xl font-bold">评论</h2>

      {/* 主评论表单 - 放在评论列表上方 */}
      <div ref={formRef} className="mb-8 space-y-4">
        <h3 className="text-lg font-semibold">发表评论</h3>
        <CommentForm postId={postId} />
      </div>

      {/* 评论列表 */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          加载评论中...
        </div>
      ) : (comments ?? []).length > 0 ? (
        <div className="space-y-6">
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
      ) : (
        <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          暂无评论，来发表第一条评论吧
        </div>
      )}
    </section>
  );
}
