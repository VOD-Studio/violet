// 文章卡片组件
// 展示文章封面图、标题、摘要、标签、发布时间和浏览量
// 带有 motion hover 悬浮效果

import { Link } from "react-router"
import { motion } from "motion/react"
import { Eye, Calendar } from "lucide-react"
import type { Post } from "@/hooks/usePosts"

/** 格式化日期为中文格式 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

interface PostCardProps {
  /** 文章数据 */
  post: Post
  /** 动画延迟，用于列表中交错动画 */
  delay?: number
}

/**
 * 文章卡片组件
 * 展示文章封面、标题、摘要等信息，悬停时有轻微上浮动画
 */
export function PostCard({ post, delay = 0 }: PostCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -4 }}
      className="group overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-lg"
    >
      {/* 封面图 */}
      {post.coverImage && (
        <Link to={`/blog/${post.slug}`}>
          <div className="aspect-video overflow-hidden">
            <img
              src={post.coverImage}
              alt={post.title}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        </Link>
      )}

      <div className="p-6">
        {/* 标签列表 */}
        <div className="mb-3 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {tag.name}
            </span>
          ))}
        </div>

        {/* 文章标题 */}
        <Link to={`/blog/${post.slug}`}>
          <h3 className="mb-2 text-lg font-semibold transition-colors group-hover:text-primary">
            {post.title}
          </h3>
        </Link>

        {/* 文章摘要 */}
        <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
          {post.summary}
        </p>

        {/* 底部元信息 */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {/* 发布时间 */}
          <span className="flex items-center gap-1">
            <Calendar className="size-3.5" />
            {formatDate(post.createdAt)}
          </span>

          {/* 浏览量 */}
          <span className="flex items-center gap-1">
            <Eye className="size-3.5" />
            {post.views}
          </span>
        </div>
      </div>
    </motion.article>
  )
}
