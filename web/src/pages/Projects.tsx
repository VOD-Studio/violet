// 项目展示页
// 页面标题使用 KineticText 动态文字
// 项目卡片使用 ScrollReveal scale 动画和交错延迟
// 项目链接按钮使用 MagneticButton 磁性效果

import { ExternalLink, Github } from "lucide-react"
import { KineticText, ScrollReveal, MagneticButton } from "@/components/creative"

/** 项目数据结构 */
interface Project {
  /** 项目唯一标识 */
  id: string
  /** 项目名称 */
  title: string
  /** 项目简述 */
  description: string
  /** 技术标签 */
  tags: string[]
  /** 在线演示地址 */
  demoUrl?: string
  /** 源码仓库地址 */
  githubUrl?: string
  /** Bento Grid 占位大小 */
  size: "sm" | "md" | "lg"
}

/** 模拟项目数据，后续替换为 API 请求 */
const MOCK_PROJECTS: Project[] = [
  {
    id: "1",
    title: "博客系统",
    description: "全栈博客平台，支持 Markdown 编写、标签分类和评论功能。采用 React + Node.js + PostgreSQL 技术栈。",
    tags: ["React", "Node.js", "PostgreSQL"],
    demoUrl: "https://example.com",
    githubUrl: "https://github.com",
    size: "lg",
  },
  {
    id: "2",
    title: "任务管理工具",
    description: "简洁高效的待办事项应用，支持拖拽排序和多视图切换。",
    tags: ["React", "TypeScript"],
    githubUrl: "https://github.com",
    size: "sm",
  },
  {
    id: "3",
    title: "API 文档生成器",
    description: "自动从代码注释生成 RESTful API 文档，支持实时预览和导出。",
    tags: ["Node.js", "OpenAPI"],
    demoUrl: "https://example.com",
    size: "sm",
  },
  {
    id: "4",
    title: "图片压缩服务",
    description: "在线图片压缩工具，支持批量上传和多种格式转换，压缩率高达 80%。",
    tags: ["Go", "WebAssembly"],
    demoUrl: "https://example.com",
    githubUrl: "https://github.com",
    size: "md",
  },
  {
    id: "5",
    title: "终端美化工具",
    description: "为终端添加丰富的配色方案和自定义提示符，支持多种 Shell。",
    tags: ["Rust", "CLI"],
    githubUrl: "https://github.com",
    size: "md",
  },
]

/**
 * 根据项目大小返回对应的 Grid 类名
 * 控制 Bento Grid 中每个卡片的占位面积
 */
function getGridSpanClass(size: Project["size"]): string {
  switch (size) {
    case "lg":
      return "sm:col-span-2 sm:row-span-2"
    case "md":
      return "sm:col-span-2 sm:row-span-1"
    case "sm":
      return "sm:col-span-1 sm:row-span-1"
  }
}

/**
 * 项目展示页
 * 使用 Bento Grid 布局展示个人项目
 */
export default function Projects() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* 页面标题使用 KineticText 逐字符动画 */}
      <KineticText
        as="h1"
        animation="fadeUp"
        className="mb-4 text-3xl font-bold"
      >
        项目
      </KineticText>

      {/* 页面描述 */}
      <p className="mb-12 text-muted-foreground">
        这里是我参与开发的一些开源和个人项目。
      </p>

      {/* Bento Grid 项目卡片网格，使用 ScrollReveal scale 动画交错入场 */}
      <div className="grid auto-rows-[200px] gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_PROJECTS.map((project, index) => (
          <ScrollReveal
            key={project.id}
            animation="scale"
            delay={index * 0.1}
          >
            <div
              className={`group flex h-full flex-col justify-between rounded-xl border bg-card p-6 transition-shadow hover:shadow-md ${getGridSpanClass(project.size)}`}
            >
              {/* 项目信息区域 */}
              <div>
                {/* 项目标题 */}
                <h2 className="mb-2 text-xl font-semibold">{project.title}</h2>

                {/* 项目描述 */}
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {project.description}
                </p>
              </div>

              {/* 底部标签和链接 */}
              <div className="flex items-end justify-between">
                {/* 技术标签 */}
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* 项目链接按钮，使用 MagneticButton 磁性效果 */}
                <div className="flex gap-1">
                  {project.githubUrl && (
                    <MagneticButton>
                      <a
                        href={project.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="查看源码"
                        className="inline-flex rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Github className="size-4" />
                      </a>
                    </MagneticButton>
                  )}
                  {project.demoUrl && (
                    <MagneticButton>
                      <a
                        href={project.demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="查看演示"
                        className="inline-flex rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    </MagneticButton>
                  )}
                </div>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  )
}
