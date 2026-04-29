// 首页组件
// 包含英雄区域、最新文章卡片列表，带有淡入动画效果

import { Link } from "react-router"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

/** 最新文章的模拟数据，后续替换为 API 请求 */
const MOCK_POSTS = [
  {
    id: "1",
    title: "使用 React 19 构建现代 Web 应用",
    summary: "探索 React 19 的新特性，包括 Server Components 和 Actions 等革命性功能。",
    slug: "react-19-modern-web",
    date: "2026-04-28",
    tags: ["React", "前端"],
  },
  {
    id: "2",
    title: "Tailwind CSS v4 完全指南",
    summary: "深入了解 Tailwind CSS v4 的变化，从配置方式到全新的引擎优化。",
    slug: "tailwind-css-v4-guide",
    date: "2026-04-25",
    tags: ["CSS", "Tailwind"],
  },
  {
    id: "3",
    title: "TypeScript 6.0 新特性速览",
    summary: "TypeScript 6.0 带来了类型推断的显著改进和新的装饰器语法。",
    slug: "typescript-6-overview",
    date: "2026-04-20",
    tags: ["TypeScript", "前端"],
  },
]

/**
 * 首页组件
 * 展示英雄区域和个人最新文章
 */
export default function Home() {
  return (
    <div>
      {/* 英雄区域 */}
      <section className="container mx-auto flex flex-col items-center justify-center gap-6 px-4 py-24 text-center">
        {/* 头衔，带淡入动画 */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
        >
          你好，我是{" "}
          <span className="text-primary">开发者</span>
        </motion.h1>

        {/* 简介，带延迟淡入动画 */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-2xl text-lg text-muted-foreground"
        >
          全栈开发者，热爱开源与技术写作。专注于 React、TypeScript 和 Node.js 生态，
          在这里分享我的技术见解和项目经验。
        </motion.p>

        {/* 操作按钮，带延迟淡入动画 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex gap-3"
        >
          <Link to="/blog">
            <Button>
              阅读博客
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link to="/about">
            <Button variant="outline">了解更多</Button>
          </Link>
        </motion.div>
      </section>

      {/* 最新文章区域 */}
      <section className="container mx-auto px-4 pb-24">
        {/* 区域标题 */}
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-8 text-2xl font-bold"
        >
          最新文章
        </motion.h2>

        {/* 文章卡片网格 */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_POSTS.map((post, index) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
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
                <h3 className="mb-2 text-lg font-semibold group-hover:text-primary transition-colors">
                  {post.title}
                </h3>
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

        {/* 查看全部文章链接 */}
        <div className="mt-8 text-center">
          <Link to="/blog">
            <Button variant="outline">
              查看全部文章
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
