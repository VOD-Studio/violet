// 文章内容渲染组件
// 解析 HTML 内容，为标题添加 ID 支持目录导航

import { useMemo } from "react"
import { CodeSandbox } from "@/components/blog/CodeSandbox"
import { parseContentWithSandboxes, SANDBOX_PRESETS } from "./utils"

interface ArticleContentProps {
  /** HTML 内容 */
  html: string
}

/**
 * 为 HTML 内容中的标题添加 ID
 */
function addHeadingIds(html: string, minLevel: number, maxLevel: number): string {
  let index = 0
  const regex = /<h([1-6])([^>]*)>(.*?)<\/h\1>/gi

  return html.replace(regex, (match, level, attrs, content) => {
    const levelNum = parseInt(level)
    if (levelNum >= minLevel && levelNum <= maxLevel) {
      // 检查是否已有 id
      if (attrs.includes("id=")) {
        return match
      }
      const id = `toc-${index}`
      index++
      return `<h${level} id="${id}"${attrs}>${content}</h${level}>`
    }
    return match
  })
}

/**
 * 文章内容渲染组件
 */
export function ArticleContent({ html }: ArticleContentProps) {
  // 为标题添加 ID
  const htmlWithIds = useMemo(
    () => addHeadingIds(html, 2, 4),
    [html]
  )

  const parts = parseContentWithSandboxes(htmlWithIds)

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "html") {
          return (
            <div
              key={`html-${index}`}
              className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-20"
              dangerouslySetInnerHTML={{ __html: part.content }}
            />
          )
        }

        /* 查找沙盒预设数据 */
        const preset = SANDBOX_PRESETS[part.id]
        if (!preset) {
          return (
            <div
              key={`sandbox-${index}`}
              className="my-6 rounded-xl border border-dashed p-6 text-center text-muted-foreground"
            >
              未找到沙盒配置: {part.id}
            </div>
          )
        }

        return (
          <div key={`sandbox-${index}`} className="my-6">
            {part.description && (
              <p className="mb-2 text-sm text-muted-foreground">
                {part.description}
              </p>
            )}
            <CodeSandbox files={preset.files} height={400} />
          </div>
        )
      })}
    </>
  )
}