// 文章加载骨架屏组件

import { useState } from "react"

/**
 * 文章加载骨架屏
 */
export function ArticleSkeleton() {
  const [key] = useState(() => Math.random())

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-32 rounded bg-muted" />
        <div className="h-12 w-3/4 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="space-y-3 pt-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-4 rounded bg-muted"
              style={{ width: `${80 + key * 20}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}