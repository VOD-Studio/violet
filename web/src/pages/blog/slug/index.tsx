// 文章详情页
// 展示文章内容、元信息和评论区，支持嵌入代码沙盒

import { useParams, Link } from "react-router"
import { motion } from "motion/react"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePost } from "@/hooks/usePosts"
import { CommentSection } from "@/components/blog/CommentSection"
import { ScrollReveal } from "@/components/creative"
import { SEO } from "@/components/shared/SEO"
import { StructuredData } from "@/components/shared/StructuredData"
import {
  generateStructuredData,
  generateBreadcrumbStructuredData,
  SITE_CONFIG,
} from "@/lib/seo"
import { ArticleHeader } from "./ArticleHeader"
import { ArticleContent } from "./ArticleContent"
import { ArticleSkeleton } from "./ArticleSkeleton"
import { ArticleError } from "./ArticleError"

/**
 * 文章详情页
 */
export default function BlogSlug() {
  const { slug } = useParams<{ slug: string }>()
  const { data: post, isLoading, error } = usePost(slug)

  /* 加载态 */
  if (isLoading) {
    return <ArticleSkeleton />
  }

  /* 错误或文章不存在 */
  if (error || !post) {
    return <ArticleError error={error} />
  }

  /* 生成结构化数据 */
  const blogPostingData = generateStructuredData(post)
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "首页", url: SITE_CONFIG.url },
    { name: "博客文章", url: `${SITE_CONFIG.url}/blog` },
    { name: post.title, url: `${SITE_CONFIG.url}/blog/${post.slug}` },
  ])

  return (
    <div className="container mx-auto px-4 py-12">
      {/* SEO 配置 */}
      <SEO
        title={post.title}
        description={post.excerpt ?? post.title}
        image={post.coverImage}
        url={`${SITE_CONFIG.url}/blog/${post.slug}`}
        type="article"
        appendSiteName={false}
      />
      <StructuredData data={[blogPostingData, breadcrumbData]} />

      {/* 返回链接 */}
      <Link to="/blog">
        <Button variant="ghost" className="mb-6 gap-1">
          <ArrowLeft className="size-4" />
          返回文章列表
        </Button>
      </Link>

      {/* 文章内容 */}
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-w-0 flex-1"
      >
        {/* 文章头部 */}
        <ArticleHeader post={post} />

        {/* 文章正文 */}
        <ScrollReveal animation="fadeIn" duration={0.8}>
          <ArticleContent html={post.contentHtml ?? ""} />
        </ScrollReveal>

        {/* 评论区 */}
        <ScrollReveal animation="fadeUp" delay={0.2}>
          <CommentSection postId={post.id} />
        </ScrollReveal>
      </motion.article>
    </div>
  )
}