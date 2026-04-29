// 文章详情页
// 文章标题使用 KineticText 动态文字动画
// 文章内容区域使用 ScrollReveal 淡入动画
// 支持通过 ::sandbox[id]:: 标记嵌入代码沙盒

import { useParams, Link } from "react-router"
import { motion } from "motion/react"
import { ArrowLeft, Calendar, Eye, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePost } from "@/hooks/usePosts"
import { CommentSection } from "@/components/blog/CommentSection"
import { CodeSandbox, type SandboxFile } from "@/components/blog/CodeSandbox"
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

/** 沙盒预设数据，实际项目中可从 API 获取 */
const SANDBOX_PRESETS: Record<string, { files: SandboxFile[]; description?: string }> = {
  "react-counter": {
    files: [
      {
        path: "/App.tsx",
        code: `import { useState } from "react"

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>React 计数器示例</h1>
      <p style={{ fontSize: "1.5rem" }}>当前计数: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>
        点击 +1
      </button>
    </div>
  )
}`,
        active: true,
      },
    ],
    description: "一个简单的 React 计数器组件",
  },
  "useEffect-demo": {
    files: [
      {
        path: "/App.tsx",
        code: `import { useState, useEffect } from "react"

export default function App() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>useEffect 定时器示例</h1>
      <p style={{ fontSize: "2rem", fontVariantNumeric: "tabular-nums" }}>
        {seconds} 秒
      </p>
    </div>
  )
}`,
        active: true,
      },
    ],
    description: "演示 useEffect 的清理函数用法",
  },
}

/** 沙盒标记正则，匹配 ::sandbox[id]:: 或 ::sandbox[id]{description}:: */
const SANDBOX_MARKER = /::sandbox\[([^\]]+)\](?:\{([^}]*)\})?::/g

/**
 * 解析文章内容，在沙盒标记位置插入 CodeSandbox 组件
 * @param html 原始 HTML 内容
 */
function parseContentWithSandboxes(html: string) {
  const parts: Array<{ type: "html"; content: string } | { type: "sandbox"; id: string; description?: string }> = []
  let lastIndex = 0

  for (const match of html.matchAll(SANDBOX_MARKER)) {
    /* 添加标记之前的 HTML 内容 */
    if (match.index > lastIndex) {
      parts.push({ type: "html", content: html.slice(lastIndex, match.index) })
    }

    /* 添加沙盒标记 */
    parts.push({
      type: "sandbox",
      id: match[1],
      description: match[2] || undefined,
    })

    lastIndex = match.index + match[0].length
  }

  /* 添加剩余的 HTML 内容 */
  if (lastIndex < html.length) {
    parts.push({ type: "html", content: html.slice(lastIndex) })
  }

  return parts
}

/**
 * 文章内容渲染组件
 * 解析 HTML 内容，在沙盒标记位置嵌入 CodeSandbox
 */
function ArticleContent({ html }: { html: string }) {
  const parts = parseContentWithSandboxes(html)

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "html") {
          return (
            <div
              key={`html-${index}`}
              className="prose prose-neutral dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: part.content }}
            />
          )
        }

        /* 查找沙盒预设数据 */
        const preset = SANDBOX_PRESETS[part.id]
        if (!preset) {
          return (
            <div
              key={`sandbox-${index}`}
              className="my-6 rounded-xl border border-dashed p-6 text-center text-muted-foreground"
            >
              未找到沙盒配置: {part.id}
            </div>
          )
        }

        return (
          <div key={`sandbox-${index}`} className="my-6">
            {part.description && (
              <p className="mb-2 text-sm text-muted-foreground">
                {part.description}
              </p>
            )}
            <CodeSandbox
              files={preset.files}
              height={400}
            />
          </div>
        )
      })}
    </>
  )
}

/**
 * 文章详情页
 * 展示文章内容、元信息和评论区，支持嵌入代码沙盒
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

          {/* 文章正文内容，支持嵌入代码沙盒 */}
          <ScrollReveal animation="fadeIn" duration={0.8}>
            <ArticleContent html={post.content} />
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
