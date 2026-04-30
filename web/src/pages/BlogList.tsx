// 文章列表页
// 调用 API 获取文章列表，支持标签筛选、关键词搜索和分页功能

import { useState } from "react"
import { motion } from "motion/react"
import { Search } from "lucide-react"
import { usePosts } from "@/hooks/usePosts"
import { useTags } from "@/hooks/useTags"
import { PostCard } from "@/components/blog/PostCard"
import { TagFilter } from "@/components/blog/TagFilter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SEO } from "@/components/shared/SEO"
import { StructuredData } from "@/components/shared/StructuredData"
import { generateBreadcrumbStructuredData, SITE_CONFIG } from "@/lib/seo"

/** 每页显示的文章数量 */
const PAGE_SIZE = 6

/**
 * 文章列表页
 * 提供标签筛选、关键词搜索和分页浏览功能
 */
export default function BlogList() {
  /* 当前选中的筛选标签 slug，null 表示全部 */
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  /* 搜索关键词输入值 */
  const [searchInput, setSearchInput] = useState("")
  /* 实际提交搜索的关键词 */
  const [search, setSearch] = useState("")
  /* 当前页码 */
  const [currentPage, setCurrentPage] = useState(1)

  /* 获取标签列表 */
  const { data: tags, isLoading: tagsLoading } = useTags()

  /* 获取文章列表 */
  const { data, isLoading, error } = usePosts({
    page: currentPage,
    limit: PAGE_SIZE,
    tag: selectedTag ?? undefined,
    search: search || undefined,
  })

  const posts = data?.posts ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  /**
   * 处理标签切换
   * 切换标签时重置到第一页
   */
  function handleTagChange(tag: string | null) {
    setSelectedTag(tag)
    setCurrentPage(1)
  }

  /**
   * 处理搜索提交
   * 提交搜索时重置到第一页
   */
  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
    setCurrentPage(1)
  }

  /* 面包屑结构化数据 */
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "首页", url: SITE_CONFIG.url },
    { name: "博客文章", url: `${SITE_CONFIG.url}/blog` },
  ])

  return (
    <div className="container mx-auto px-4 py-12">
      {/* 文章列表页 SEO 配置 */}
      <SEO
        title="博客文章"
        description="浏览所有技术文章，涵盖前端开发、后端架构、数据库、DevOps 等领域。"
        url={`${SITE_CONFIG.url}/blog`}
      />
      <StructuredData data={breadcrumbData} />

      {/* 页面标题 */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-3xl font-bold"
      >
        博客文章
      </motion.h1>

      {/* 搜索栏 */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索文章..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit">搜索</Button>
      </form>

      {/* 标签筛选栏 */}
      <TagFilter
        tags={tags ?? []}
        selectedTag={selectedTag}
        onTagChange={handleTagChange}
        isLoading={tagsLoading}
      />

      {/* 加载态 */}
      {isLoading && (
        <div className="grid gap-6 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-lg border bg-muted"
            />
          ))}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="py-12 text-center text-muted-foreground">{String(error)}</div>
      )}

      {/* 文章卡片网格 */}
      {!isLoading && !error && (
        <div className="grid gap-6 sm:grid-cols-2">
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} delay={index * 0.05} />
          ))}
        </div>
      )}

      {/* 无搜索结果提示 */}
      {!isLoading && !error && posts.length === 0 && (
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
            {"<"}
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
            {">"}
          </Button>
        </div>
      )}
    </div>
  )
}
