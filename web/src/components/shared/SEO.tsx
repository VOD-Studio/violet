// SEO 组件
// 通过 useEffect 直接操作 document.head 动态设置页面标题、meta 标签和 canonical 链接
// 组件卸载时自动清理，避免页面切换时残留上一页的 meta 信息

import { useEffect } from "react"
import {
  generateTitle,
  generateMetaTags,
  SITE_CONFIG,
  type SEOConfig,
} from "@/lib/seo"

/**
 * 将 meta 标签数组应用到 document.head
 * 为每个标签创建 <meta> 元素并标记 data-seo 属性以便后续清理
 *
 * @param tags 由 generateMetaTags 生成的标签属性数组
 */
function applyMetaTags(tags: Array<{ name?: string; property?: string; content: string }>) {
  for (const tag of tags) {
    const meta = document.createElement("meta")
    meta.setAttribute("data-seo", "true")

    if (tag.name) {
      meta.setAttribute("name", tag.name)
    }
    if (tag.property) {
      meta.setAttribute("property", tag.property)
    }

    meta.setAttribute("content", tag.content)
    document.head.appendChild(meta)
  }
}

/**
 * 清理之前由 SEO 组件注入的 meta 标签
 * 移除所有带有 data-seo 标记的元素
 */
function cleanupSEOTags() {
  const elements = document.head.querySelectorAll("[data-seo]")
  for (const el of elements) {
    el.remove()
  }
}

/**
 * SEO 组件属性
 * 继承 SEOConfig 的所有字段，并增加 appendSiteName 控制
 */
interface SEOProps extends SEOConfig {
  /** 是否在标题后追加站点名称，默认 true */
  appendSiteName?: boolean
}

/**
 * SEO 组件
 * 动态设置 document.title 和各种 meta 标签
 * 在组件卸载时自动清理注入的标签
 *
 * @example
 * <SEO title="首页" description="欢迎来到我的博客" />
 * <SEO title={post.title} description={post.summary} type="article" />
 */
export function SEO({
  title,
  description,
  keywords,
  author,
  image,
  url,
  type = "website",
  appendSiteName = true,
}: SEOProps) {
  useEffect(() => {
    /* 设置页面标题 */
    document.title = generateTitle(title, appendSiteName)

    /* 构建 SEO 配置 */
    const config: SEOConfig = {
      title: appendSiteName ? generateTitle(title) : title,
      description,
      keywords,
      author: author ?? SITE_CONFIG.author,
      image: image ?? SITE_CONFIG.image,
      url,
      type,
    }

    /* 生成并应用 meta 标签 */
    const tags = generateMetaTags(config)
    applyMetaTags(tags)

    /* 设置 canonical 链接 */
    if (url) {
      const link = document.createElement("link")
      link.setAttribute("rel", "canonical")
      link.setAttribute("href", url)
      link.setAttribute("data-seo", "true")
      document.head.appendChild(link)
    }

    /* 组件卸载时清理所有注入的标签 */
    return () => {
      cleanupSEOTags()
    }
  }, [title, description, keywords, author, image, url, type, appendSiteName])

  /* 该组件不渲染任何 DOM 元素 */
  return null
}
