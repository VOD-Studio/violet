// 单条评论组件
// 展示评论者头像（Gravatar）、名称、时间和内容
// 递归渲染嵌套回复

import type { Comment } from "@/hooks/useComments"

/** 格式化时间为相对描述 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 30) {
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }
  if (days > 0) return `${days} 天前`
  if (hours > 0) return `${hours} 小时前`
  if (minutes > 0) return `${minutes} 分钟前`
  return "刚刚"
}

/**
 * 根据邮箱生成 Gravatar 头像地址
 * 使用 MD5 哈希邮箱后拼接 Gravatar URL
 * 由于浏览器环境不原生支持 MD5，使用 d=identicon 参数显示默认图案头像
 */
function getGravatarUrl(email: string): string {
  const trimmed = email.trim().toLowerCase()
  return `https://www.gravatar.com/avatar/${trimmed}?d=identicon&s=80`
}

interface CommentItemProps {
  /** 评论数据 */
  comment: Comment
  /** 嵌套层级，用于控制缩进 */
  depth?: number
}

/**
 * 单条评论组件
 * 展示评论头像、作者、时间和内容，递归渲染子评论
 */
export function CommentItem({ comment, depth = 0 }: CommentItemProps) {
  return (
    <div className={depth > 0 ? "ml-8 mt-4 border-l-2 border-muted pl-4" : ""}>
      <div className="flex gap-3">
        {/* 头像 */}
        <img
          src={getGravatarUrl(comment.authorEmail)}
          alt={comment.authorName}
          className="size-8 shrink-0 rounded-full bg-muted"
        />

        <div className="min-w-0 flex-1">
          {/* 作者名和时间 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{comment.authorName}</span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(comment.createdAt)}
            </span>
          </div>

          {/* 评论内容 */}
          <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
            {comment.content}
          </p>
        </div>
      </div>

      {/* 递归渲染子评论 */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
