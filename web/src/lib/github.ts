// GitHub API 工具函数
// 通过后端代理调用 GitHub API，Token 在后台管理面板配置
// 提供贡献数据和仓库信息的获取，支持 sessionStorage 缓存

import { api } from "@/lib/api";

/** 缓存过期时间，单位毫秒（30 分钟） */
const CACHE_TTL = 30 * 60 * 1000;

/** 缓存键前缀 */
const CACHE_PREFIX = "github_cache_";

/** 贡献数据中每一天的信息 */
export interface ContributionDay {
  /** 日期字符串，格式 YYYY-MM-DD */
  date: string;
  /** 贡献数量 */
  count: number;
  /** 贡献等级 0-4 */
  level: number;
}

/** 贡献数据响应 */
export interface ContributionData {
  /** 总贡献数 */
  totalContributions: number;
  /** 每日贡献详情 */
  days: ContributionDay[];
}

/** 空的贡献数据，当请求失败时返回 */
const EMPTY_CONTRIBUTION_DATA: ContributionData = {
  totalContributions: 0,
  days: [],
};

/** 仓库信息 */
export interface RepoData {
  /** 仓库名称 */
  name: string;
  /** 仓库描述 */
  description: string | null;
  /** 主要语言 */
  language: string | null;
  /** Star 数量 */
  stargazerCount: number;
  /** Fork 数量 */
  forkCount: number;
  /** 仓库链接 */
  url: string;
  /** 是否为 fork 仓库 */
  isFork: boolean;
  /** 主要语言颜色 */
  languageColor: string | null;
}

/**
 * 从 sessionStorage 读取缓存
 */
function getCached<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return data as T;
  } catch {
    return null;
  }
}

/**
 * 写入 sessionStorage 缓存
 */
function setCache<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, timestamp: Date.now() }),
    );
  } catch {
    /* 存储空间不足时静默忽略 */
  }
}

/**
 * 通过后端代理获取 GitHub 用户贡献数据
 * Token 在后台管理面板配置，前端无需关心认证
 */
export async function fetchGitHubContributions(
  username: string,
): Promise<ContributionData> {
  const cacheKey = `contributions_${username}`;
  const cached = getCached<ContributionData>(cacheKey);
  if (cached) return cached;

  try {
    const data = await api.get<ContributionData>(
      `/github/contributions?username=${encodeURIComponent(username)}`,
    );
    setCache(cacheKey, data);
    return data;
  } catch {
    return EMPTY_CONTRIBUTION_DATA;
  }
}

/**
 * 通过后端代理获取 GitHub 用户仓库数据
 * Token 在后台管理面板配置，前端无需关心认证
 */
export async function fetchGitHubRepos(username: string): Promise<RepoData[]> {
  const cacheKey = `repos_${username}`;
  const cached = getCached<RepoData[]>(cacheKey);
  if (cached) return cached;

  try {
    const data = await api.get<RepoData[]>(
      `/github/repos?username=${encodeURIComponent(username)}`,
    );
    setCache(cacheKey, data);
    return data;
  } catch {
    return [];
  }
}
