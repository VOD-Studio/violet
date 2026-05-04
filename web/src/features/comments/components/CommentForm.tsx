/**
 * 评论表单组件
 * 统一的评论/回复表单，支持富文本表情输入
 */

import { useState, useRef, useCallback } from "react";
import { AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { RichTextInput, type RichTextInputRef } from "./RichTextInput";
import { EmojiButton } from "./EmojiButton";
import { ReplyIndicator } from "./ReplyIndicator";
import { useSubmitComment } from "../api";
import { useAuthStore } from "@/store";
import { toast } from "sonner";

interface CommentFormProps {
  /** 文章 ID */
  postId: string;
  /** 回复的父评论 ID */
  parentId?: string;
  /** 回复目标的名称 */
  replyTo?: string;
  /** 取消回复回调 */
  onCancel?: () => void;
  /** 提交成功回调 */
  onSuccess?: () => void;
  /** 自定义样式 */
  className?: string;
}

/**
 * 评论表单
 * 包含用户信息输入、富文本输入、表情选择器
 */
export function CommentForm({
  postId,
  parentId,
  replyTo,
  onCancel,
  onSuccess,
  className,
}: CommentFormProps) {
  const { user } = useAuthStore();
  const submitMutation = useSubmitComment(postId);
  const richTextRef = useRef<RichTextInputRef>(null);

  const [authorName, setAuthorName] = useState(user?.username || "");
  const [authorEmail, setAuthorEmail] = useState(user?.email || "");
  const [content, setContent] = useState("");

  /**
   * 处理表情选择
   */
  const handleEmojiSelect = useCallback(
    (emojiName: string, emojiDisplay: string) => {
      richTextRef.current?.insertEmoji(emojiName, emojiDisplay);
    },
    []
  );

  /**
   * 提交评论
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // 验证必填字段
      if (!content.trim()) {
        toast.error("请输入评论内容");
        return;
      }

      if (!user && !authorName.trim()) {
        toast.error("请输入昵称");
        return;
      }

      try {
        await submitMutation.mutateAsync({
          body: content.trim(),
          author_name: authorName.trim(),
          author_email: authorEmail.trim() || undefined,
          parent_id: parentId,
        });

        // 提交成功，清空输入
        richTextRef.current?.clear();
        setContent("");
        toast.success(parentId ? "回复发表成功" : "评论发表成功");
        onSuccess?.();
      } catch (error: any) {
        // 错误处理
        if (error.response?.status === 400) {
          toast.error("评论内容不符合要求");
        } else if (error.response?.status === 404) {
          toast.error("文章不存在");
        } else if (error.response?.status === 429) {
          toast.error("评论过于频繁，请稍后再试");
        } else {
          toast.error("评论发表失败，请稍后重试");
        }
      }
    },
    [content, authorName, authorEmail, parentId, submitMutation, onSuccess]
  );

  /**
   * 取消回复
   */
  const handleCancelReply = useCallback(() => {
    richTextRef.current?.clear();
    setContent("");
    onCancel?.();
  }, [onCancel]);

  const isSubmitting = submitMutation.isPending;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "rounded-8 border border-border bg-background overflow-hidden",
        "focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20",
        "transition-all",
        className
      )}
    >
      {/* 回复提示条 */}
      <AnimatePresence>
        {replyTo && (
          <ReplyIndicator replyTo={replyTo} onCancel={handleCancelReply} />
        )}
      </AnimatePresence>

      {/* 用户信息输入（未登录时显示） */}
      {!user && (
        <div className="flex gap-3 px-4 pt-3 pb-2 border-b border-border">
          <input
            type="text"
            placeholder="昵称 *"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            disabled={isSubmitting}
            className={cn(
              "flex-1 px-3 py-1.5 text-sm rounded border border-border",
              "bg-background placeholder:text-muted-foreground",
              "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all"
            )}
            required
          />
          <input
            type="email"
            placeholder="邮箱（可选，用于显示头像）"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            disabled={isSubmitting}
            className={cn(
              "flex-1 px-3 py-1.5 text-sm rounded border border-border",
              "bg-background placeholder:text-muted-foreground",
              "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all"
            )}
          />
        </div>
      )}

      {/* 富文本输入 */}
      <RichTextInput
        ref={richTextRef}
        onChange={setContent}
        placeholder={replyTo ? `回复 ${replyTo}...` : "说点什么..."}
        disabled={isSubmitting}
      />

      {/* 底部工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t border-border">
        {/* 左侧：表情按钮 */}
        <div className="flex items-center gap-2">
          <EmojiButton onSelect={handleEmojiSelect} disabled={isSubmitting} />
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-2">
          {replyTo && (
            <button
              type="button"
              onClick={handleCancelReply}
              disabled={isSubmitting}
              className={cn(
                "px-4 py-1.5 text-sm rounded",
                "border border-border",
                "hover:bg-muted transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              取消
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !content.trim() || !authorName.trim()}
            className={cn(
              "px-4 py-1.5 text-sm rounded",
              "bg-primary text-primary-foreground",
              "hover:bg-primary/90 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "font-medium"
            )}
          >
            {isSubmitting ? "发送中..." : "发送"}
          </button>
        </div>
      </div>
    </form>
  );
}
