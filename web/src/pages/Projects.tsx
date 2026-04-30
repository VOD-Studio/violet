// 项目展示页
// 从 API 获取项目数据，使用 ProjectCard 增强组件展示
// 包含代码沙盒示例，API 不存在时显示空状态

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { KineticText, ScrollReveal } from "@/components/creative"
import { ProjectCard, type ProjectData } from "@/components/blog/ProjectCard"
import { CodeSandbox, type SandboxFile } from "@/components/blog/CodeSandbox"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorFallback } from "@/components/shared/ErrorFallback"

/**
 * 从 API 获取项目列表
 */
function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      try {
        return await api.get<ProjectData[]>("/projects")
      } catch {
        return []
      }
    },
    placeholderData: [],
  })
}

/** 代码沙盒示例代码 */
const SANDBOX_FILES: SandboxFile[] = [
  {
    path: "/App.tsx",
    code: `import { useState } from "react"

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
        React 计数器
      </h1>
      <p style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
        当前计数: {count}
      </p>
      <button
        onClick={() => setCount(count + 1)}
        style={{
          padding: "0.5rem 1.5rem",
          fontSize: "1rem",
          borderRadius: "0.5rem",
          border: "none",
          background: "#3b82f6",
          color: "white",
          cursor: "pointer",
        }}
      >
        点击 +1
      </button>
    </div>
  )
}`,
    active: true,
  },
]

/** 项目网格骨架屏 */
function ProjectGridSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-80 animate-pulse rounded-lg border bg-muted" />
      ))}
    </div>
  )
}

/**
 * 项目展示页
 * 从 API 获取项目数据，支持代码沙盒示例
 */
export default function Projects() {
  const { data: projects, isLoading, error, refetch } = useProjects()

  return (
    <div className="container mx-auto px-4 py-12">
      {/* 页面标题 */}
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

      {/* 加载态 */}
      {isLoading && <ProjectGridSkeleton />}

      {/* 错误状态 */}
      {error && (
        <ErrorFallback error={error.message} onRetry={refetch} />
      )}

      {/* 空数据状态 */}
      {!isLoading && !error && (!projects || projects.length === 0) && (
        <EmptyState
          title="暂无项目数据"
          description="项目数据即将上线，敬请期待"
          icon={
            <svg className="size-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          }
        />
      )}

      {/* 项目卡片网格 */}
      {!isLoading && !error && projects && projects.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, index) => (
            <ScrollReveal
              key={project.id}
              animation="scale"
              delay={index * 0.1}
            >
              <ProjectCard project={project} />
            </ScrollReveal>
          ))}
        </div>
      )}

      {/* 代码沙盒示例区域 */}
      <section className="mt-16">
        <ScrollReveal animation="fadeUp">
          <h2 className="mb-2 text-2xl font-bold">在线代码沙盒</h2>
          <p className="mb-6 text-muted-foreground">
            无需搭建本地环境，直接在浏览器中体验代码运行效果。
          </p>
        </ScrollReveal>

        <ScrollReveal animation="fadeIn" delay={0.2}>
          <CodeSandbox
            files={SANDBOX_FILES}
            height={420}
            showConsole={false}
          />
        </ScrollReveal>
      </section>
    </div>
  )
}
