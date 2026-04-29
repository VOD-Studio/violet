// 首页组件
// 英雄区域使用 KineticText 动态文字和 ParticleBackground 粒子背景
// 文章卡片列表使用 ScrollReveal 滚动显示动画，支持交错延迟
// "查看全部文章" 按钮使用 MagneticButton 磁性效果

import { Link } from "react-router"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePosts } from "@/hooks/usePosts"
import { PostCard } from "@/components/blog/PostCard"
import {
  KineticText,
  ParticleBackground,
  ScrollReveal,
  MagneticButton,
} from "@/components/creative"
import { SEO } from "@/components/shared/SEO"
import { StructuredData } from "@/components/shared/StructuredData"
import { generateWebsiteStructuredData, SITE_CONFIG } from "@/lib/seo"

/**
 * 首页组件
 * 展示英雄区域和个人最新文章
 */
export default function Home() {
  /* 获取最新 3 篇文章 */
  const { data, isLoading, error } = usePosts({ page: 1, limit: 3 })
  const posts = data?.posts ?? []

  /* 站点级别结构化数据 */
  const websiteData = generateWebsiteStructuredData()

  return (
    <div>
      {/* 首页 SEO 配置 */}
      <SEO
        title="首页"
        description={SITE_CONFIG.description}
        url={SITE_CONFIG.url}
        type="website"
      />
      <StructuredData data={websiteData} />

      {/* 英雄区域，粒子背景覆盖整个区域 */}
      <section className="relative container mx-auto flex flex-col items-center justify-center gap-6 overflow-hidden px-4 py-24 text-center">
        {/* 粒子背景，absolute 定位铺满区域 */}
        <ParticleBackground
          className="absolute inset-0 h-full w-full"
          particleCount={60}
        />

        {/* 标题使用 KineticText 逐字符动态入场 */}
        <KineticText
          as="h1"
          animation="fadeUp"
          splitMode="char"
          className="relative z-10 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
        >
          你好，我是开发者
        </KineticText>

        {/* 简介，带延迟淡入动画 */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative z-10 max-w-2xl text-lg text-muted-foreground"
        >
          全栈开发者，热爱开源与技术写作。专注于 React、TypeScript 和 Node.js 生态，
          在这里分享我的技术见解和项目经验。
        </motion.p>

        {/* 操作按钮，带延迟淡入动画 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="relative z-10 flex gap-3"
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

        {/* 文章卡片网格，使用 ScrollReveal 实现交错入场 */}
        {!isLoading && !error && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, index) => (
              <ScrollReveal
                key={post.id}
                animation="fadeUp"
                delay={index * 0.1}
              >
                <PostCard post={post} delay={0} />
              </ScrollReveal>
            ))}
          </div>
        )}

        {/* 空数据提示 */}
        {!isLoading && !error && posts.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            暂无文章
          </div>
        )}

        {/* 查看全部文章按钮，使用 MagneticButton 磁性效果 */}
        <div className="mt-8 text-center">
          <MagneticButton className="inline-block">
            <Link to="/blog">
              <Button variant="outline">
                查看全部文章
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </MagneticButton>
        </div>
      </section>
    </div>
  )
}
