// 评论区组件
// 展示评论列表（嵌套展示）和评论表单
// 支持提交评论和加载状态

import { useState } from "react"
import { useComments } from "@/hooks/useComments"
import { CommentItem } from "./CommentItem"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface CommentSectionProps {
  /** 文章 ID */
  postId: string
}

/**
 * 评论区组件
 * 包含评论列表展示和评论提交表单
 */
export function CommentSection({ postId }: CommentSectionProps) {
  const { data: comments, isLoading, submitComment } = useComments(postId)

  /* 表单状态 */
  const [authorName, setAuthorName] = useState("")
  const [authorEmail, setAuthorEmail] = useState("")
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  /**
   * 处理评论提交
   * 验证表单后调用 API 提交，成功后清空表单
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!authorName.trim() || !authorEmail.trim() || !content.trim()) return

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await submitComment({
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim(),
        content: content.trim(),
      })
      /* 提交成功后清空评论内容，保留用户信息方便后续评论 */
      setContent("")
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "评论提交失败")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mt-16 border-t pt-8">
      <h2 className="mb-6 text-xl font-bold">评论</h2>

      {/* 评论列表 */}
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          加载评论中...
        </div>
      ) : comments.length > 0 ? (
        <div className="mb-8 space-y-6">
          {comments.map((comment) => (
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

        {/* 名称和邮箱 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="comment-name">名称</Label>
            <Input
              id="comment-name"
              placeholder="你的名称"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comment-email">邮箱</Label>
            <Input
              id="comment-email"
              type="email"
              placeholder="你的邮箱（不会公开）"
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              required
            />
          </div>
        </div>

        {/* 评论内容 */}
        <div className="space-y-2">
          <Label htmlFor="comment-content">评论内容</Label>
          <Textarea
            id="comment-content"
            placeholder="写下你的评论..."
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>

        {/* 提交错误提示 */}
        {submitError && (
          <p className="text-sm text-destructive">{submitError}</p>
        )}

        {/* 提交按钮 */}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "提交中..." : "发表评论"}
        </Button>
      </form>
    </section>
  )
}
