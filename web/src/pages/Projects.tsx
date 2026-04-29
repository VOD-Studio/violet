// 项目展示页
// 使用 ProjectCard 增强组件展示项目，支持技术栈标签和 GitHub 统计
// 包含代码沙盒示例

import { KineticText, ScrollReveal } from "@/components/creative"
import { ProjectCard, type ProjectData } from "@/components/blog/ProjectCard"
import { CodeSandbox, type SandboxFile } from "@/components/blog/CodeSandbox"

/** 模拟项目数据，后续替换为 API 请求 */
const MOCK_PROJECTS: ProjectData[] = [
  {
    id: "1",
    title: "博客系统",
    description: "全栈博客平台，支持 Markdown 编写、标签分类和评论功能。采用 React + Node.js + PostgreSQL 技术栈。",
    coverImage: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&h=400&fit=crop",
    tags: ["React", "Node.js", "TypeScript", "PostgreSQL"],
    demoUrl: "https://example.com",
    githubUrl: "https://github.com",
    stars: 128,
    forks: 32,
  },
  {
    id: "2",
    title: "任务管理工具",
    description: "简洁高效的待办事项应用，支持拖拽排序和多视图切换。",
    coverImage: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&h=400&fit=crop",
    tags: ["React", "TypeScript", "Tailwind"],
    githubUrl: "https://github.com",
    stars: 56,
    forks: 12,
  },
  {
    id: "3",
    title: "API 文档生成器",
    description: "自动从代码注释生成 RESTful API 文档，支持实时预览和导出。",
    coverImage: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=600&h=400&fit=crop",
    tags: ["Node.js", "OpenAPI", "TypeScript"],
    demoUrl: "https://example.com",
    githubUrl: "https://github.com",
    stars: 234,
    forks: 45,
  },
  {
    id: "4",
    title: "图片压缩服务",
    description: "在线图片压缩工具，支持批量上传和多种格式转换，压缩率高达 80%。",
    coverImage: "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=600&h=400&fit=crop",
    tags: ["Go", "WebAssembly", "Docker"],
    demoUrl: "https://example.com",
    githubUrl: "https://github.com",
    stars: 89,
    forks: 18,
  },
  {
    id: "5",
    title: "终端美化工具",
    description: "为终端添加丰富的配色方案和自定义提示符，支持多种 Shell。",
    coverImage: "https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=600&h=400&fit=crop",
    tags: ["Rust", "CLI", "Linux"],
    githubUrl: "https://github.com",
    stars: 412,
    forks: 67,
  },
  {
    id: "6",
    title: "实时聊天应用",
    description: "基于 WebSocket 的即时通讯应用，支持群聊、文件传输和消息撤回。",
    coverImage: "https://images.unsplash.com/photo-1611606063065-ee7946f0787a?w=600&h=400&fit=crop",
    tags: ["React", "Node.js", "Redis", "Docker"],
    demoUrl: "https://example.com",
    githubUrl: "https://github.com",
    stars: 167,
    forks: 29,
  },
]

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

/**
 * 项目展示页
 * 使用增强的 ProjectCard 组件和代码沙盒示例
 */
export default function Projects() {
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

      {/* 项目卡片网格 */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_PROJECTS.map((project, index) => (
          <ScrollReveal
            key={project.id}
            animation="scale"
            delay={index * 0.1}
          >
            <ProjectCard project={project} />
          </ScrollReveal>
        ))}
      </div>

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
