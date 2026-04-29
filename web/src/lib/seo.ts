// SEO 工具函数
// 提供文章 SEO 数据生成、JSON-LD 结构化数据生成和 meta 标签配置

/** SEO 配置项 */
export interface SEOConfig {
  /** 页面标题 */
  title: string
  /** 页面描述 */
  description: string
  /** 关键词列表 */
  keywords?: string[]
  /** 作者名称 */
  author?: string
  /** 页面图片 */
  image?: string
  /** 页面完整 URL */
  url?: string
  /** 页面类型，默认 website */
  type?: "website" | "article"
  /** 是否显示站点名称后缀 */
  appendSiteName?: boolean
}

/** 文章数据结构，用于生成 SEO 数据 */
interface PostForSEO {
  /** 文章标题 */
  title: string
  /** 文章摘要 */
  summary: string
  /** URL 别名 */
  slug: string
  /** 封面图地址 */
  coverImage?: string
  /** 发布时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt?: string
  /** 作者信息 */
  author?: {
    username: string
    avatar?: string
  }
  /** 标签列表 */
  tags?: Array<{ name: string }>
}

/** 站点基础配置 */
const SITE_CONFIG = {
  name: "开发者博客",
  description: "全栈开发者的技术博客，分享 React、TypeScript、Node.js 等技术经验与项目实践。",
  url: import.meta.env.VITE_SITE_URL ?? "https://example.com",
  author: "开发者",
  image: "/og-default.png",
}

/** 导出站点配置供其他模块使用 */
export { SITE_CONFIG }

/**
 * 生成完整页面标题
 * 根据配置决定是否追加站点名称后缀
 *
 * @param title 页面标题
 * @param appendSiteName 是否追加站点名称
 * @returns 完整标题字符串
 */
export function generateTitle(title: string, appendSiteName = true): string {
  if (!appendSiteName) return title
  return `${title} | ${SITE_CONFIG.name}`
}

/**
 * 生成文章的 SEO 数据
 * 从文章对象中提取标题、描述、关键词等信息
 *
 * @param post 文章数据
 * @returns SEO 配置对象
 */
export function generatePostSEO(post: PostForSEO): SEOConfig {
  const keywords = post.tags?.map((tag) => tag.name) ?? []
  const url = `${SITE_CONFIG.url}/blog/${post.slug}`
  const image = post.coverImage ?? SITE_CONFIG.image

  return {
    title: generateTitle(post.title),
    description: post.summary,
    keywords,
    author: post.author?.username ?? SITE_CONFIG.author,
    image,
    url,
    type: "article",
    appendSiteName: false,
  }
}

/**
 * 生成 JSON-LD 结构化数据
 * 生成 BlogPosting schema，符合 Google 搜索结构化数据规范
 *
 * @param post 文章数据
 * @returns JSON-LD 对象
 */
export function generateStructuredData(post: PostForSEO): Record<string, unknown> {
  const url = `${SITE_CONFIG.url}/blog/${post.slug}`
  const image = post.coverImage ?? SITE_CONFIG.image

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    image,
    url,
    datePublished: post.createdAt,
    dateModified: post.updatedAt ?? post.createdAt,
    author: {
      "@type": "Person",
      name: post.author?.username ?? SITE_CONFIG.author,
      image: post.author?.avatar,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_CONFIG.name,
      url: SITE_CONFIG.url,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    keywords: post.tags?.map((tag) => tag.name).join(", "),
  }
}

/**
 * 生成 JSON-LD 站点级别结构化数据
 * 生成 WebSite schema，包含站点名称和搜索框信息
 *
 * @returns WebSite JSON-LD 对象
 */
export function generateWebsiteStructuredData(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    description: SITE_CONFIG.description,
    author: {
      "@type": "Person",
      name: SITE_CONFIG.author,
    },
  }
}

/**
 * 生成 JSON-LD 作者结构化数据
 * 生成 Person schema
 *
 * @param name 作者名称
 * @param avatar 作者头像地址
 * @returns Person JSON-LD 对象
 */
export function generatePersonStructuredData(
  name?: string,
  avatar?: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: name ?? SITE_CONFIG.author,
    url: SITE_CONFIG.url,
    image: avatar,
  }
}

/**
 * 生成 JSON-LD 面包屑结构化数据
 * 生成 BreadcrumbList schema
 *
 * @param items 面包屑项列表，每项包含名称和路径
 * @returns BreadcrumbList JSON-LD 对象
 */
export function generateBreadcrumbStructuredData(
  items: Array<{ name: string; url: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * 生成 meta 标签配置
 * 将 SEO 配置对象转换为标准化的 meta 标签属性列表
 *
 * @param config SEO 配置
 * @returns meta 标签属性数组
 */
export function generateMetaTags(config: SEOConfig): Array<{
  name?: string
  property?: string
  content: string
}> {
  const tags: Array<{ name?: string; property?: string; content: string }> = []

  /* 基础 meta 标签 */
  tags.push({
    name: "description",
    content: config.description,
  })

  if (config.keywords?.length) {
    tags.push({
      name: "keywords",
      content: config.keywords.join(", "),
    })
  }

  if (config.author) {
    tags.push({
      name: "author",
      content: config.author,
    })
  }

  /* Open Graph 标签 */
  tags.push({ property: "og:title", content: config.title })
  tags.push({ property: "og:description", content: config.description })
  tags.push({ property: "og:type", content: config.type ?? "website" })

  if (config.url) {
    tags.push({ property: "og:url", content: config.url })
  }

  if (config.image) {
    tags.push({ property: "og:image", content: config.image })
  }

  /* Twitter Card 标签 */
  tags.push({ name: "twitter:card", content: "summary_large_image" })
  tags.push({ name: "twitter:title", content: config.title })
  tags.push({ name: "twitter:description", content: config.description })

  if (config.image) {
    tags.push({ name: "twitter:image", content: config.image })
  }

  return tags
}
