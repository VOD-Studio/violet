// 文章详情页
// 展示文章完整内容、目录导航和评论区域

import { useParams, Link } from "react-router"
import { motion } from "motion/react"
import { ArrowLeft, Calendar, Clock, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"

/** 模拟文章数据，后续替换为 API 请求 */
const MOCK_POST = {
  title: "使用 React 19 构建现代 Web 应用",
  date: "2026-04-28",
  readTime: "8 分钟",
  tags: ["React", "前端"],
  content: `
## 引言

React 19 带来了许多令人兴奋的新特性，让我们一起来探索如何利用这些特性构建更好的 Web 应用。

## Server Components

Server Components 允许我们在服务端渲染组件，减少客户端 JavaScript 的体积。

## Actions

Actions 简化了表单处理和数据变更的流程。

## 总结

React 19 的这些新特性将彻底改变我们构建 Web 应用的方式。
  `.trim(),
  /** 文章目录结构 */
  toc: [
    { id: "introduction", title: "引言", level: 2 },
    { id: "server-components", title: "Server Components", level: 2 },
    { id: "actions", title: "Actions", level: 2 },
    { id: "summary", title: "总结", level: 2 },
  ],
}

/**
 * 文章详情页
 * 展示文章内容、目录和评论区
 */
export default function BlogPost() {
  /** 从路由参数获取文章 slug */
  const { slug } = useParams<{ slug: string }>()

  /* 后续使用 slug 从 API 获取文章数据 */
  void slug

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
            <h1 className="mb-4 text-3xl font-bold lg:text-4xl">
              {MOCK_POST.title}
            </h1>

            {/* 文章元信息 */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {/* 发布日期 */}
              <span className="flex items-center gap-1">
                <Calendar className="size-4" />
                {MOCK_POST.date}
              </span>

              {/* 阅读时长 */}
              <span className="flex items-center gap-1">
                <Clock className="size-4" />
                {MOCK_POST.readTime}
              </span>

              {/* 标签列表 */}
              <div className="flex items-center gap-1">
                <Tag className="size-4" />
                {MOCK_POST.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </header>

          {/* 文章正文内容 */}
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            {MOCK_POST.content.split("\n\n").map((paragraph) => {
              if (paragraph.startsWith("## ")) {
                return (
                  <h2 key={paragraph} id={paragraph.replace("## ", "").toLowerCase()}>
                    {paragraph.replace("## ", "")}
                  </h2>
                )
              }
              return <p key={paragraph}>{paragraph}</p>
            })}
          </div>

          {/* 评论区占位 */}
          <section className="mt-16 border-t pt-8">
            <h2 className="mb-6 text-xl font-bold">评论</h2>
            <div className="rounded-lg border bg-muted/30 p-8 text-center text-muted-foreground">
              评论功能开发中，敬请期待
            </div>
          </section>
        </motion.article>

        {/* 文章目录侧边栏 */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20">
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground">
              目录
            </h3>
            <nav className="flex flex-col gap-1">
              {MOCK_POST.toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  style={{ paddingLeft: `${(item.level - 2) * 12}px` }}
                >
                  {item.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>
      </div>
    </div>
  )
}
