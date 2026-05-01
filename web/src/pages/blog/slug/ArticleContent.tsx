// 文章内容渲染组件
// 解析 HTML 内容，在沙盒标记位置嵌入 CodeSandbox

import { CodeSandbox } from "@/components/blog/CodeSandbox"
import { parseContentWithSandboxes, SANDBOX_PRESETS } from "./utils"

interface ArticleContentProps {
  /** HTML 内容 */
  html: string
}

/**
 * 文章内容渲染组件
 * 解析 HTML 内容，在沙盒标记位置嵌入 CodeSandbox
 */
export function ArticleContent({ html }: ArticleContentProps) {
  const parts = parseContentWithSandboxes(html)

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === "html") {
          return (
            <div
              key={`html-${index}`}
              className="prose prose-neutral dark:prose-invert max-w-none"
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