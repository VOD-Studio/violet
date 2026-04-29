// 增强项目卡片组件
// 展示项目封面、名称、描述、技术栈标签、GitHub 链接和 Demo 链接
// 使用 motion 实现悬停放大和阴影效果

import { motion } from "motion/react"
import { ExternalLink, Star, GitFork } from "lucide-react"
import { FaGithub } from "react-icons/fa"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { TechStackBadge } from "./TechStackBadge"

/** 项目数据结构 */
interface ProjectData {
  /** 项目唯一标识 */
  id: string
  /** 项目名称 */
  title: string
  /** 项目简述 */
  description: string
  /** 封面图地址 */
  coverImage?: string
  /** 技术栈标签列表 */
  tags: string[]
  /** GitHub 仓库地址 */
  githubUrl?: string
  /** GitHub Star 数量 */
  stars?: number
  /** GitHub Fork 数量 */
  forks?: number
  /** 在线演示地址 */
  demoUrl?: string
}

interface ProjectCardProps {
  /** 项目数据 */
  project: ProjectData
  /** 动画延迟，用于列表中交错动画 */
  delay?: number
}

/**
 * 增强项目卡片组件
 * 展示项目的完整信息，悬停时有放大和阴影增强效果
 */
export function ProjectCard({ project, delay = 0 }: ProjectCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="h-full"
    >
      <Card className="group/card flex h-full flex-col overflow-hidden">
        {/* 封面图 */}
        {project.coverImage && (
          <div className="aspect-video overflow-hidden">
            <img
              src={project.coverImage}
              alt={project.title}
              className="size-full object-cover transition-transform duration-500 group-hover/card:scale-105"
            />
          </div>
        )}

        <CardContent className="flex flex-1 flex-col gap-3">
          {/* 项目名称 */}
          <h3 className="text-lg font-semibold leading-tight tracking-tight">
            {project.title}
          </h3>

          {/* 项目描述 */}
          <p className="flex-1 text-sm text-muted-foreground line-clamp-3">
            {project.description}
          </p>

          {/* 技术栈标签 */}
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <TechStackBadge key={tag} tech={tag} size="sm" />
            ))}
          </div>
        </CardContent>

        {/* 底部链接区域 */}
        <CardFooter>
          <div className="flex w-full items-center justify-between">
            {/* GitHub 链接和统计数据 */}
            {project.githubUrl ? (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <FaGithub className="size-4" />
                {/* Star 和 Fork 计数 */}
                {(project.stars != null || project.forks != null) && (
                  <div className="flex items-center gap-2">
                    {project.stars != null && (
                      <span className="flex items-center gap-0.5">
                        <Star className="size-3" />
                        {formatCount(project.stars)}
                      </span>
                    )}
                    {project.forks != null && (
                      <span className="flex items-center gap-0.5">
                        <GitFork className="size-3" />
                        {formatCount(project.forks)}
                      </span>
                    )}
                  </div>
                )}
              </a>
            ) : (
              <div />
            )}

            {/* Demo 链接 */}
            {project.demoUrl && (
              <a
                href={project.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                查看演示
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

/**
 * 格式化数字计数
 * 大于 1000 显示为 k 单位
 */
function formatCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return String(count)
}

export type { ProjectData }
