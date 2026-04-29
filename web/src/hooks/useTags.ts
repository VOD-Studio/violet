// 标签数据 Hook
// 获取所有标签列表，用于标签筛选功能

import { useState, useEffect } from "react"
import { api } from "@/lib/api"

/** 标签数据结构 */
interface Tag {
  /** 标签 ID */
  id: string
  /** 标签名称 */
  name: string
  /** URL 别名 */
  slug: string
}

/**
 * 获取所有标签
 */
export function useTags() {
  const [data, setData] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchTags() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await api.get<Tag[]>("/tags")
        if (!cancelled) {
          setData(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "获取标签失败")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchTags()

    return () => {
      cancelled = true
    }
  }, [])

  return { data, isLoading, error }
}

export type { Tag }
