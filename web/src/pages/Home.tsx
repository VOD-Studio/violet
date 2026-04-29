// 首页组件
// 包含英雄区域、最新文章卡片列表，带有淡入动画效果
// 调用 usePosts 获取最新文章数据

import { Link } from "react-router"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePosts } from "@/hooks/usePosts"
import { PostCard } from "@/components/blog/PostCard"

/**
 * 首页组件
 * 展示英雄区域和个人最新文章
 */
export default function Home() {
  /* 获取最新 3 篇文章 */
  const { data, isLoading, error } = usePosts({ page: 1, limit: 3 })
  const posts = data?.posts ?? []

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

        {/* 加载态 */}
        {isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-lg border bg-muted"
              />
            ))}
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="py-12 text-center text-muted-foreground">
            {error}
          </div>
        )}

        {/* 文章卡片网格 */}
        {!isLoading && !error && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, index) => (
              <PostCard key={post.id} post={post} delay={index * 0.1} />
            ))}
          </div>
        )}

        {/* 空数据提示 */}
        {!isLoading && !error && posts.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            暂无文章
          </div>
        )}

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
