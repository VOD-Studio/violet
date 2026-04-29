// 代码沙盒嵌入组件
// 基于 Sandpack 实现轻量级代码沙盒，支持自定义代码和依赖
// 使用 IntersectionObserver 实现懒加载，响应式布局

import { useState, useEffect, useRef, useCallback } from "react"
import { Loader2 } from "lucide-react"

/** Sandpack 主题类型 */
type SandboxTheme = "light" | "dark" | "auto"

/** 单个文件定义 */
interface SandboxFile {
  /** 文件路径，如 "/App.tsx" */
  path: string
  /** 文件内容 */
  code: string
  /** 是否为活跃文件（默认打开的文件） */
  active?: boolean
}

/** 依赖包定义 */
interface SandboxDependency {
  /** 包名 */
  name: string
  /** 版本号 */
  version: string
}

interface CodeSandboxProps {
  /** 文件列表 */
  files: SandboxFile[]
  /** 额外依赖 */
  dependencies?: SandboxDependency[]
  /** 主入口文件路径，默认 "/App.tsx" */
  entry?: string
  /** 主题，默认 "auto" 跟随系统 */
  theme?: SandboxTheme
  /** 沙盒高度，默认 400 */
  height?: number
  /** 是否显示控制台 */
  showConsole?: boolean
  /** 是否显示导航栏 */
  showNavigator?: boolean
}

/**
 * 代码沙盒嵌入组件
 * 支持自定义代码和依赖，响应式布局，懒加载优化
 */
export function CodeSandbox({
  files,
  dependencies = [],
  entry = "/App.tsx",
  theme = "auto",
  height = 400,
  showConsole = false,
  showNavigator = false,
}: CodeSandboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [SandpackComponent, setSandpackComponent] = useState<React.ComponentType<Record<string, unknown>> | null>(null)

  /* 使用 IntersectionObserver 实现懒加载 */
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries
    if (entry.isIntersecting) {
      setIsVisible(true)
    }
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: "200px",
      threshold: 0,
    })

    const current = containerRef.current
    if (current) {
      observer.observe(current)
    }

    return () => {
      if (current) {
        observer.unobserve(current)
      }
    }
  }, [handleIntersection])

  /* 当组件进入视口后动态加载 Sandpack */
  useEffect(() => {
    if (!isVisible) return

    let cancelled = false

    async function loadSandpack() {
      try {
        const mod = await import("@codesandbox/sandpack-react")
        if (!cancelled) {
          setSandpackComponent(() => mod.Sandpack)
          setIsLoading(false)
        }
      } catch {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadSandpack()

    return () => {
      cancelled = true
    }
  }, [isVisible])

  /* 检测系统主题偏好 */
  const resolvedTheme = (() => {
    if (theme !== "auto") return theme
    if (typeof window === "undefined") return "light"
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  })()

  /* 构建文件映射 */
  const filesMap: Record<string, { code: string; active?: boolean }> = {}
  for (const file of files) {
    filesMap[file.path] = { code: file.code, active: file.active }
  }

  /* 构建依赖映射 */
  const depsMap: Record<string, string> = {}
  for (const dep of dependencies) {
    depsMap[dep.name] = dep.version
  }

  return (
    <div
      ref={containerRef}
      className="my-6 overflow-hidden rounded-xl border"
      style={{ height }}
    >
      {/* 加载态占位 */}
      {isLoading && (
        <div className="flex size-full items-center justify-center bg-muted/50">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <span className="text-sm">加载代码沙盒...</span>
          </div>
        </div>
      )}

      {/* Sandpack 组件 */}
      {SandpackComponent && (
        <SandpackComponent
          template="react-ts"
          files={filesMap}
          theme={resolvedTheme}
          options={{
            visibleFiles: files.filter((f) => f.active).map((f) => f.path),
            activeFile: entry,
            showNavigator,
            showConsole,
            editorHeight: height - 42,
            externalResources: [],
          }}
          customSetup={{
            dependencies: depsMap,
          }}
        />
      )}

      {/* 错误态：Sandpack 加载失败 */}
      {!isLoading && !SandpackComponent && (
        <div className="flex size-full items-center justify-center bg-muted/50">
          <p className="text-sm text-muted-foreground">
            代码沙盒加载失败，请检查网络连接
          </p>
        </div>
      )}
    </div>
  )
}

export type { SandboxFile, SandboxDependency, SandboxTheme }
