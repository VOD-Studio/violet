// GitHub 数据 Hook
// 提供 useGitHubContributions 和 useGitHubRepos 两个 Hook
// 内置加载状态、错误处理和请求去重

import { useState, useEffect, useRef, useCallback } from "react"
import {
  fetchGitHubContributions,
  fetchGitHubRepos,
  type ContributionData,
  type RepoData,
} from "@/lib/github"

/** Hook 返回值的通用结构 */
interface UseGitHubResult<T> {
  /** 请求到的数据 */
  data: T | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: string | null
  /** 手动重新获取数据 */
  refetch: () => void
}

/** 正在进行中的请求缓存，避免同一用户名的重复请求 */
const pendingRequests = new Map<string, Promise<unknown>>()

/**
 * 获取 GitHub 用户贡献数据的 Hook
 * 自动缓存，避免重复请求
 *
 * @param username - GitHub 用户名
 * @returns 包含数据、加载状态和错误信息的对象
 */
export function useGitHubContributions(
  username: string,
): UseGitHubResult<ContributionData> {
  const [data, setData] = useState<ContributionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchData = useCallback(async () => {
    if (!username) return

    setIsLoading(true)
    setError(null)

    try {
      /* 如果已有相同请求正在进行，复用该请求 */
      const cacheKey = `contributions_${username}`
      let promise = pendingRequests.get(cacheKey) as Promise<ContributionData>

      if (!promise) {
        promise = fetchGitHubContributions(username)
        pendingRequests.set(cacheKey, promise)

        /* 请求完成后清除 pending 缓存 */
        promise.finally(() => pendingRequests.delete(cacheKey))
      }

      const result = await promise

      /* 组件已卸载则不更新状态 */
      if (mountedRef.current) {
        setData(result)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(
          err instanceof Error ? err.message : "获取贡献数据失败",
        )
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [username])

  useEffect(() => {
    mountedRef.current = true
    fetchData()

    return () => {
      mountedRef.current = false
    }
  }, [fetchData])

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  }
}

/**
 * 获取 GitHub 用户仓库数据的 Hook
 * 自动缓存，避免重复请求
 *
 * @param username - GitHub 用户名
 * @returns 包含数据、加载状态和错误信息的对象
 */
export function useGitHubRepos(
  username: string,
): UseGitHubResult<RepoData[]> {
  const [data, setData] = useState<RepoData[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchData = useCallback(async () => {
    if (!username) return

    setIsLoading(true)
    setError(null)

    try {
      /* 如果已有相同请求正在进行，复用该请求 */
      const cacheKey = `repos_${username}`
      let promise = pendingRequests.get(cacheKey) as Promise<RepoData[]>

      if (!promise) {
        promise = fetchGitHubRepos(username)
        pendingRequests.set(cacheKey, promise)

        promise.finally(() => pendingRequests.delete(cacheKey))
      }

      const result = await promise

      if (mountedRef.current) {
        setData(result)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(
          err instanceof Error ? err.message : "获取仓库数据失败",
        )
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [username])

  useEffect(() => {
    mountedRef.current = true
    fetchData()

    return () => {
      mountedRef.current = false
    }
  }, [fetchData])

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  }
}
