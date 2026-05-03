// 表情系统 Hook
// 获取表情分组和表情，支持搜索和显示内容获取

import { useState, useEffect, useCallback } from "react"
import { api, getUploadUrl } from "@/lib/api"
import type { EmojiGroup, EmojisResponse } from "@/types/emoji"

// 统一的表情项接口（用于选择器展示）
export interface EmojiItem {
  id: number
  name: string
  // 显示内容：图片URL 或文本
  display: string
  // 插入语法 [表情名]
  syntax: string
  // 来源类型
  source: EmojiGroup["source"]
}

// 统一的表情分类接口（用于选择器分组展示）
export interface EmojiCategory {
  id: number
  name: string
  source: EmojiGroup["source"]
  items: EmojiItem[]
}

interface UseEmojisResult {
  // 所有表情分组
  groups: EmojiGroup[]
  // 统一格式的分类（用于选择器）
  categories: EmojiCategory[]
  // 加载状态
  loading: boolean
  // 错误信息
  error: string | null
  // 搜索功能：跨所有表情搜索
  search: (query: string) => EmojiItem[]
  // 根据语法 `[表情名]` 获取显示内容
  getDisplayByName: (name: string) => string | null
  // 刷新表情数据
  refresh: () => Promise<void>
}

// 将 API 返回的分组转换为选择器分类格式
function transformGroupsToCategories(groups: EmojiGroup[]): EmojiCategory[] {
  return groups
    .filter((g) => g.isEnabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((group) => ({
      id: group.id,
      name: group.name,
      source: group.source,
      items: (group.emojis || [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((emoji) => ({
          id: emoji.id,
          name: emoji.name,
          display: emoji.url ? getUploadUrl(emoji.url) : emoji.textContent || emoji.name,
          syntax: `[${emoji.name}]`,
          source: group.source,
        })),
    }))
}

// 构建表情名称到显示内容的映射
function buildEmojiMap(groups: EmojiGroup[]): Map<string, string> {
  const map = new Map<string, string>()
  groups.forEach((group) => {
    (group.emojis || []).forEach((emoji) => {
      const display = emoji.url ? getUploadUrl(emoji.url) : emoji.textContent || emoji.name
      map.set(emoji.name, display)
    })
  })
  return map
}

export function useEmojis(): UseEmojisResult {
  const [groups, setGroups] = useState<EmojiGroup[]>([])
  const [emojiMap, setEmojiMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 获取表情数据
  const fetchEmojis = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await api.get<EmojisResponse>("/emojis")
      setGroups(response.groups || [])
      setEmojiMap(buildEmojiMap(response.groups || []))
    } catch (err) {
      console.error("Failed to fetch emojis:", err)
      setError("加载表情失败")
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始化加载
  useEffect(() => {
    fetchEmojis()
  }, [fetchEmojis])

  // 转换为选择器分类格式
  const categories = transformGroupsToCategories(groups)

  // 搜索功能：跨所有表情搜索
  const search = useCallback(
    (query: string): EmojiItem[] => {
      if (!query.trim()) return []

      const lowerQuery = query.toLowerCase()
      const results: EmojiItem[] = []

      groups
        .filter((g) => g.isEnabled)
        .forEach((group) => {
          (group.emojis || []).forEach((emoji) => {
            if (emoji.name.toLowerCase().includes(lowerQuery)) {
              results.push({
                id: emoji.id,
                name: emoji.name,
                display: emoji.url ? getUploadUrl(emoji.url) : emoji.textContent || emoji.name,
                syntax: `[${emoji.name}]`,
                source: group.source,
              })
            }
          })
        })

      return results
    },
    [groups],
  )

  // 根据表情名获取显示内容
  const getDisplayByName = useCallback(
    (name: string): string | null => {
      return emojiMap.get(name) || null
    },
    [emojiMap],
  )

  return {
    groups,
    categories,
    loading,
    error,
    search,
    getDisplayByName,
    refresh: fetchEmojis,
  }
}