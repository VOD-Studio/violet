// 文章详情页
// 文章标题使用 KineticText 动态文字动画
// 文章内容区域使用 ScrollReveal 淡入动画
// 侧边目录区域使用 ScrollReveal 从右侧滑入

import { useParams, Link } from "react-router"
import { motion } from "motion/react"
import { ArrowLeft, Calendar, Eye, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePost } from "@/hooks/usePosts"
import { CommentSection } from "@/components/blog/CommentSection"
import { KineticText, ScrollReveal } from "@/components/creative"

/** 格式化日期为中文格式 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * 文章详情页
 * 展示文章内容、元信息和评论区
 */
export default function BlogPost() {
  /* 从路由参数获取文章 slug */
  const { slug } = useParams<{ slug: string }>()
  const { data: post, isLoading, error } = usePost(slug)

  /* 加载态 */
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-32 rounded bg-muted" />
          <div className="h-12 w-3/4 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
          <div className="space-y-3 pt-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 rounded bg-muted" style={{ width: `${80 + Math.random() * 20}%` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* 错误或文章不存在 */
  if (error || !post) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Link to="/blog">
          <Button variant="ghost" className="mb-6 gap-1">
            <ArrowLeft className="size-4" />
            返回文章列表
          </Button>
        </Link>
        <div className="py-12 text-center text-muted-foreground">
          {error ?? "文章不存在"}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* 返回博客列表链接 */}
      <Link to="/blog">
        <Button variant="ghost" className="mb-6 gap-1">
          <ArrowLeft className="size-4" />
          返回文章列表
        </Button>
      </Link>

      <div className="flex gap-12">
        {/* 文章主内容区 */}
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-w-0 flex-1"
        >
          {/* 文章头部信息 */}
          <header className="mb-8">
            {/* 文章标题使用 KineticText 逐字符 fadeUp 动画 */}
            <KineticText
              as="h1"
              animation="fadeUp"
              staggerDelay={0.02}
              className="mb-4 text-3xl font-bold lg:text-4xl"
            >
              {post.title}
            </KineticText>

            {/* 文章元信息 */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {/* 作者 */}
              {post.author && (
                <span className="flex items-center gap-1">
                  {post.author.avatar && (
                    <img
                      src={post.author.avatar}
                      alt={post.author.username}
                      className="size-5 rounded-full"
                    />
                  )}
                  {post.author.username}
                </span>
              )}

              {/* 发布日期 */}
              <span className="flex items-center gap-1">
                <Calendar className="size-4" />
                {formatDate(post.createdAt)}
              </span>

              {/* 浏览量 */}
              <span className="flex items-center gap-1">
                <Eye className="size-4" />
                {post.views} 次浏览
              </span>

              {/* 标签列表 */}
              {post.tags.length > 0 && (
                <div className="flex items-center gap-1">
                  <Tag className="size-4" />
                  {post.tags.map((tag) => (
                    <Link
                      key={tag.id}
                      to={`/blog?tag=${tag.slug}`}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs transition-colors hover:bg-muted/80"
                    >
                      {tag.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </header>

          {/* 文章正文内容，使用 ScrollReveal fadeIn 动画 */}
          <ScrollReveal animation="fadeIn" duration={0.8}>
            <div
              className="prose prose-neutral dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </ScrollReveal>

          {/* 评论区 */}
          <ScrollReveal animation="fadeUp" delay={0.2}>
            <CommentSection postId={post.id} />
          </ScrollReveal>
        </motion.article>
      </div>
    </div>
  )
}
