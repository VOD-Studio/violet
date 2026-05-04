// 单条评论组件
// 展示评论者头像（Gravatar）、名称、时间和内容
// 递归渲染嵌套回复
// 支持回复功能

import { motion, AnimatePresence } from "motion/react";
import { MessageSquare } from "lucide-react";
import type { Comment } from "../api";
import { ReactionBar } from "./ReactionBar";
import { CommentForm } from "./CommentForm";
import { CommentContent } from "./CommentContent";

/** 格式化时间为相对描述 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) {
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  if (days > 0) return `${days} 天前`;
  if (hours > 0) return `${hours} 小时前`;
  if (minutes > 0) return `${minutes} 分钟前`;
  return "刚刚";
}

/**
 * 根据邮箱生成 Gravatar 头像地址
 * 使用 MD5 哈希邮箱后拼接 Gravatar URL
 * 由于浏览器环境不原生支持 MD5，使用 d=identicon 参数显示默认图案头像
 */
function getGravatarUrl(email?: string): string {
  if (!email) {
    return `https://www.gravatar.com/avatar/?d=identicon&s=80`;
  }
  const trimmed = email.trim().toLowerCase();
  return `https://www.gravatar.com/avatar/${trimmed}?d=identicon&s=80`;
}

interface CommentItemProps {
  /** 评论数据 */
  comment: Comment;
  /** 文章 ID（用于回复） */
  postId: string;
  /** 嵌套层级，用于控制缩进 */
  depth?: number;
  /** 当前回复的评论 ID */
  replyingTo?: string | null;
  /** 触发回复回调 */
  onReply?: (commentId: string, authorName: string) => void;
  /** 取消回复回调 */
  onCancelReply?: () => void;
}

/**
 * 单条评论组件
 * 展示评论头像、作者、时间和内容，递归渲染子评论
 */
export function CommentItem({
  comment,
  postId,
  depth = 0,
  replyingTo,
  onReply,
  onCancelReply,
}: CommentItemProps) {
  const isReplying = replyingTo === comment.id;

  return (
    <div className={depth > 0 ? "ml-8 mt-4 border-l-2 border-muted pl-4" : ""}>
      <div className="flex gap-3">
        {/* 头像 */}
        <img
          src={getGravatarUrl(comment.author_email)}
          alt={comment.author_name}
          className="size-8 shrink-0 rounded-full bg-muted"
        />

        <div className="min-w-0 flex-1">
          {/* 作者名和时间 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{comment.author_name}</span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(comment.created_at)}
            </span>
          </div>

          {/* 评论内容（纯文本 + 表情） */}
          <CommentContent
            html={comment.body}
            className="mt-1 text-sm text-muted-foreground prose prose-sm max-w-none"
          />

          {/* 操作栏：回复按钮 + 表情反应 */}
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => onReply?.(comment.id, comment.author_name)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
              aria-label={`回复 ${comment.author_name}`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>回复</span>
            </button>
            <ReactionBar commentId={comment.id} />
          </div>
        </div>
      </div>

      {/* 回复表单（展开动画） */}
      <AnimatePresence>
        {isReplying && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden mt-4 ml-11"
          >
            <CommentForm
              postId={postId}
              parentId={comment.id}
              replyTo={comment.author_name}
              onCancel={onCancelReply}
              onSuccess={onCancelReply}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 递归渲染子评论 */}
      {comment.children && comment.children.length > 0 && (
        <div className="mt-3">
          {comment.children.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              depth={depth + 1}
              replyingTo={replyingTo}
              onReply={onReply}
              onCancelReply={onCancelReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}
