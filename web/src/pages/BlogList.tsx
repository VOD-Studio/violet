// 文章列表页
// 展示文章卡片网格布局，支持标签筛选和分页功能

import { useState, useMemo } from "react"
import { Link } from "react-router"
import { motion } from "motion/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** 文章数据的模拟列表，后续替换为 API 请求 */
const MOCK_POSTS = [
  {
    id: "1",
    title: "使用 React 19 构建现代 Web 应用",
    summary: "探索 React 19 的新特性，包括 Server Components 和 Actions。",
    slug: "react-19-modern-web",
    date: "2026-04-28",
    tags: ["React", "前端"],
  },
  {
    id: "2",
    title: "Tailwind CSS v4 完全指南",
    summary: "深入了解 Tailwind CSS v4 的变化和引擎优化。",
    slug: "tailwind-css-v4-guide",
    date: "2026-04-25",
    tags: ["CSS", "Tailwind"],
  },
  {
    id: "3",
    title: "TypeScript 6.0 新特性速览",
    summary: "TypeScript 6.0 带来了类型推断的显著改进。",
    slug: "typescript-6-overview",
    date: "2026-04-20",
    tags: ["TypeScript", "前端"],
  },
  {
    id: "4",
    title: "Node.js 性能优化实战",
    summary: "分享 Node.js 应用性能优化的实用技巧和最佳实践。",
    slug: "nodejs-performance",
    date: "2026-04-15",
    tags: ["Node.js", "后端"],
  },
  {
    id: "5",
    title: "Docker 容器化部署完全手册",
    summary: "从零开始学习 Docker 容器化部署的完整流程。",
    slug: "docker-deploy-guide",
    date: "2026-04-10",
    tags: ["Docker", "DevOps"],
  },
  {
    id: "6",
    title: "PostgreSQL 高级查询技巧",
    summary: "掌握 PostgreSQL 的高级查询语法和性能调优。",
    slug: "postgresql-advanced",
    date: "2026-04-05",
    tags: ["PostgreSQL", "数据库"],
  },
]

/** 每页显示的文章数量 */
const PAGE_SIZE = 4

/**
 * 文章列表页
 * 提供标签筛选和分页浏览功能
 */
export default function BlogList() {
  /** 当前选中的筛选标签，null 表示全部 */
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  /** 当前页码，从 1 开始 */
  const [currentPage, setCurrentPage] = useState(1)

  /** 提取所有不重复的标签 */
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const post of MOCK_POSTS) {
      for (const tag of post.tags) {
        tags.add(tag)
      }
    }
    return Array.from(tags)
  }, [])

  /** 根据选中标签筛选文章 */
  const filteredPosts = useMemo(() => {
    if (!selectedTag) return MOCK_POSTS
    return MOCK_POSTS.filter((post) => post.tags.includes(selectedTag))
  }, [selectedTag])

  /** 计算总页数 */
  const totalPages = Math.ceil(filteredPosts.length / PAGE_SIZE)

  /** 获取当前页的文章 */
  const paginatedPosts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredPosts.slice(start, start + PAGE_SIZE)
  }, [filteredPosts, currentPage])

  /**
   * 处理标签点击
   * 切换筛选标签时重置到第一页
   */
  const handleTagClick = (tag: string | null) => {
    setSelectedTag(tag)
    setCurrentPage(1)
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* 页面标题 */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-3xl font-bold"
      >
        博客文章
      </motion.h1>

      {/* 标签筛选栏 */}
      <div className="mb-8 flex flex-wrap gap-2">
        {/* 全部标签按钮 */}
        <button
          onClick={() => handleTagClick(null)}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            selectedTag === null
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          全部
        </button>

        {/* 各个标签按钮 */}
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => handleTagClick(tag)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              selectedTag === tag
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* 文章卡片网格 */}
      <div className="grid gap-6 sm:grid-cols-2">
        {paginatedPosts.map((post, index) => (
          <motion.article
            key={post.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="group rounded-lg border bg-card p-6 transition-shadow hover:shadow-md"
          >
            {/* 文章标签 */}
            <div className="mb-3 flex gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* 文章标题 */}
            <Link to={`/blog/${post.slug}`}>
              <h2 className="mb-2 text-xl font-semibold group-hover:text-primary transition-colors">
                {post.title}
              </h2>
            </Link>

            {/* 文章摘要 */}
            <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
              {post.summary}
            </p>

            {/* 发布日期 */}
            <time className="text-xs text-muted-foreground">{post.date}</time>
          </motion.article>
        ))}
      </div>

      {/* 无搜索结果提示 */}
      {paginatedPosts.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          暂无文章
        </div>
      )}

      {/* 分页控件 */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          {/* 上一页按钮 */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="size-4" />
          </Button>

          {/* 页码按钮 */}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={page === currentPage ? "default" : "outline"}
              size="icon"
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </Button>
          ))}

          {/* 下一页按钮 */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
