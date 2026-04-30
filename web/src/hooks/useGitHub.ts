// GitHub 数据 Hook
// 使用 react-query 管理 GitHub 贡献数据和仓库数据
// 内置缓存策略和请求去重

import { useQuery } from "@tanstack/react-query"
import {
  fetchGitHubContributions,
  fetchGitHubRepos,
} from "@/lib/github"

/**
 * 获取 GitHub 用户贡献数据的 Hook
 * react-query 自动处理缓存、去重和重试
 *
 * @param username - GitHub 用户名
 */
export function useGitHubContributions(username: string) {
  return useQuery({
    queryKey: ["github", "contributions", username],
    queryFn: () => fetchGitHubContributions(username),
    enabled: !!username,
    /** GitHub 数据缓存 30 分钟 */
    staleTime: 30 * 60 * 1000,
  })
}

/**
 * 获取 GitHub 用户仓库数据的 Hook
 * react-query 自动处理缓存、去重和重试
 *
 * @param username - GitHub 用户名
 */
export function useGitHubRepos(username: string) {
  return useQuery({
    queryKey: ["github", "repos", username],
    queryFn: () => fetchGitHubRepos(username),
    enabled: !!username,
    /** 仓库数据缓存 30 分钟 */
    staleTime: 30 * 60 * 1000,
  })
}
