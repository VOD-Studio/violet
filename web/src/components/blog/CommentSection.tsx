// 评论区组件
// 展示评论列表（嵌套展示）和评论表单
// 支持提交评论和加载状态
// 已登录用户自动填充用户名和邮箱
// 监测评论区进入视口状态并更新 store

import { useState, useEffect, useRef } from "react";
import { useComments, useSubmitComment } from "@/hooks/useComments";
import { useAuthStore, usePostStore } from "@/store";
import { CommentItem } from "./CommentItem";
import { EmojiPickerButton } from "@/components/comment/EmojiPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Comment } from "@/hooks/useComments";

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
  const submitMutation = useSubmitComment(postId);
  const sectionRef = useRef<HTMLElement>(null);
  const { user } = useAuthStore();
  const { setHasReachedComments } = usePostStore();

  /* 表单状态 */
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [content, setContent] = useState("");

  // 已登录用户自动填充用户名和邮箱
  useEffect(() => {
    if (user) {
      setAuthorName(user.username || "");
      setAuthorEmail(user.email || "");
    }
  }, [user]);

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
   * 处理评论提交
   * 验证表单后调用 API 提交，成功后清空表单
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !content.trim()) return;

    try {
      await submitMutation.mutateAsync({
        author_name: authorName.trim(),
        author_email: authorEmail.trim() || undefined,
        body: content.trim(),
      });
      setContent("");
    } catch {
      /* 错误由 mutation 处理 */
    }
  }

  return (
    <section ref={sectionRef} className="mt-16 border-t pt-8">
      <h2 className="mb-6 text-xl font-bold">评论</h2>

      {/* 评论列表 */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          加载评论中...
        </div>
      ) : (comments ?? []).length > 0 ? (
        <div className="mb-8 space-y-6">
          {(comments ?? []).map((comment: Comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      ) : (
        <div className="mb-8 rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          暂无评论，来发表第一条评论吧
        </div>
      )}

      {/* 评论表单 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-semibold">发表评论</h3>

        {/* 已登录用户显示用户信息 */}
        {user ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <span>以</span>
            <span className="font-medium text-foreground">
              {user.username}
            </span>
            <span>的身份发表评论</span>
          </div>
        ) : (
          /* 未登录用户需要输入名称和邮箱 */
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="comment-name">名称 *</Label>
              <Input
                id="comment-name"
                placeholder="你的名称"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comment-email">邮箱（可选）</Label>
              <Input
                id="comment-email"
                type="email"
                placeholder="你的邮箱（不会公开）"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* 评论内容 */}
        <div className="space-y-2">
          <Label htmlFor="comment-content">评论内容 *</Label>
          <div className="relative">
            <Textarea
              id="comment-content"
              placeholder="写下你的评论..."
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
            {/* 表情选择器按钮 */}
            <div className="absolute bottom-2 right-2">
              <EmojiPickerButton
                onSelect={(syntax) => setContent((prev) => prev + syntax)}
              />
            </div>
          </div>
        </div>

        {/* 提交错误提示 */}
        {submitMutation.error && (
          <p className="text-sm text-destructive">
            {submitMutation.error.message}
          </p>
        )}

        {/* 提交按钮 */}
        <Button type="submit" disabled={submitMutation.isPending}>
          {submitMutation.isPending ? "提交中..." : "发表评论"}
        </Button>
      </form>
    </section>
  );
}
