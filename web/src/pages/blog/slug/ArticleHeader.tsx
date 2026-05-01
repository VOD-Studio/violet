// 文章头部信息组件
// 展示标题、作者、发布日期、浏览量和标签

import { Link } from "react-router"
import { Calendar, Eye, Tag } from "lucide-react"
import { KineticText } from "@/components/creative"
import type { PostDetail } from "@/hooks/usePosts"

/** 格式化日期为中文格式 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/** 判断两个日期是否相同（忽略时分秒） */
function isSameDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

interface ArticleHeaderProps {
  /** 文章详情 */
  post: PostDetail
}

/**
 * 文章头部信息组件
 * 展示标题、作者、日期、浏览量和标签
 */
export function ArticleHeader({ post }: ArticleHeaderProps) {
  return (
    <header className="mb-8">
      {/* 文章标题 */}
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
          {post.updatedAt && !isSameDay(post.createdAt, post.updatedAt) ? (
            <span>
              发布于 {formatDate(post.createdAt)}，更新于 {formatDate(post.updatedAt)}
            </span>
          ) : (
            formatDate(post.createdAt)
          )}
        </span>

        {/* 浏览量 */}
        <span className="flex items-center gap-1">
          <Eye className="size-4" />
          {(post.viewCount ?? 0).toLocaleString()} 次浏览
        </span>

        {/* 标签列表 */}
        {(post.tags?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1">
            <Tag className="size-4" />
            {post.tags?.map((tag) => (
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
  )
}