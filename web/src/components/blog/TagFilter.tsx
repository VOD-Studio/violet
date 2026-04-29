// 标签筛选组件
// 展示标签列表，支持点击筛选和当前选中高亮

import { cn } from "@/lib/utils"
import type { Tag } from "@/hooks/useTags"

interface TagFilterProps {
  /** 标签列表 */
  tags: Tag[]
  /** 当前选中的标签 slug，null 表示全部 */
  selectedTag: string | null
  /** 标签点击回调 */
  onTagChange: (tag: string | null) => void
  /** 是否正在加载 */
  isLoading?: boolean
}

/**
 * 标签筛选组件
 * 提供"全部"按钮和各标签按钮，点击切换筛选条件
 */
export function TagFilter({
  tags,
  selectedTag,
  onTagChange,
  isLoading,
}: TagFilterProps) {
  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {/* 全部标签按钮 */}
      <button
        onClick={() => onTagChange(null)}
        className={cn(
          "rounded-full px-3 py-1 text-sm font-medium transition-colors",
          selectedTag === null
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
        )}
      >
        全部
      </button>

      {/* 加载态骨架占位 */}
      {isLoading &&
        Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-7 w-16 animate-pulse rounded-full bg-muted"
          />
        ))}

      {/* 各个标签按钮 */}
      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => onTagChange(tag.slug)}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            selectedTag === tag.slug
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          {tag.name}
        </button>
      ))}
    </div>
  )
}
