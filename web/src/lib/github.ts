// GitHub API 工具函数
// 封装 GitHub REST API 和 GraphQL API 调用
// 提供贡献数据和仓库信息的获取，支持 sessionStorage 缓存

/** 缓存过期时间，单位毫秒（30 分钟） */
const CACHE_TTL = 30 * 60 * 1000

/** 缓存键前缀 */
const CACHE_PREFIX = "github_cache_"

/** 贡献数据中每一天的信息 */
export interface ContributionDay {
  /** 日期字符串，格式 YYYY-MM-DD */
  date: string
  /** 贡献数量 */
  count: number
  /** 贡献等级 0-4 */
  level: number
}

/** 贡献数据响应 */
export interface ContributionData {
  /** 总贡献数 */
  totalContributions: number
  /** 每日贡献详情 */
  days: ContributionDay[]
}

/** 仓库信息 */
export interface RepoData {
  /** 仓库名称 */
  name: string
  /** 仓库描述 */
  description: string | null
  /** 主要语言 */
  language: string | null
  /** Star 数量 */
  stargazerCount: number
  /** Fork 数量 */
  forkCount: number
  /** 仓库链接 */
  url: string
  /** 是否为 fork 仓库 */
  isFork: boolean
  /** 主要语言颜色 */
  languageColor: string | null
}

/**
 * 从 sessionStorage 读取缓存
 * @param key - 缓存键名
 * @returns 缓存的数据，不存在或已过期返回 null
 */
function getCached<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null

    const { data, timestamp } = JSON.parse(raw)
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_PREFIX + key)
      return null
    }

    return data as T
  } catch {
    return null
  }
}

/**
 * 写入 sessionStorage 缓存
 * @param key - 缓存键名
 * @param data - 要缓存的数据
 */
function setCache<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, timestamp: Date.now() }),
    )
  } catch {
    /* 存储空间不足时静默忽略 */
  }
}

/** 语言名称到颜色的映射 */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Vue: "#41b883",
  CSS: "#563d7c",
  HTML: "#e34c26",
  Shell: "#89e051",
  Lua: "#000080",
  Zig: "#ec915c",
}

/**
 * 获取语言对应的颜色
 * @param language - 语言名称
 * @returns 颜色十六进制字符串
 */
function getLanguageColor(language: string | null): string | null {
  if (!language) return null
  return LANGUAGE_COLORS[language] ?? null
}

/**
 * 通过 GitHub GraphQL API 获取用户贡献数据
 * 返回最近 365 天的每日贡献统计
 *
 * @param username - GitHub 用户名
 * @returns 贡献数据，包含总数和每日详情
 */
export async function fetchGitHubContributions(
  username: string,
): Promise<ContributionData> {
  const cacheKey = `contributions_${username}`
  const cached = getCached<ContributionData>(cacheKey)
  if (cached) return cached

  const query = `
    query($username: String!) {
      user(login: $username) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                color
              }
            }
          }
        }
      }
    }
  `

  const token = import.meta.env.VITE_GITHUB_TOKEN as string | undefined

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  /* 如果配置了 GitHub Token，附加到请求头以提高速率限制 */
  if (token) {
    headers.Authorization = `bearer ${token}`
  }

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables: { username } }),
  })

  if (!response.ok) {
    throw new Error(`GitHub GraphQL 请求失败: ${response.status}`)
  }

  const json = await response.json()

  if (json.errors?.length) {
    throw new Error(json.errors[0].message ?? "GitHub API 返回错误")
  }

  const calendar =
    json.data.user.contributionsCollection.contributionCalendar

  /* 将 GitHub 返回的周数据展平为每日数组 */
  const days: ContributionDay[] = calendar.weeks.flatMap(
    (week: { contributionDays: Array<{ date: string; contributionCount: number; color: string }> }) =>
      week.contributionDays.map(
        (day: { date: string; contributionCount: number; color: string }) => ({
          date: day.date,
          count: day.contributionCount,
          /* 根据贡献数量计算等级 0-4 */
          level: getLevelFromCount(day.contributionCount),
        }),
      ),
  )

  const result: ContributionData = {
    totalContributions: calendar.totalContributions,
    days,
  }

  setCache(cacheKey, result)
  return result
}

/**
 * 根据贡献数量计算等级
 * @param count - 贡献数量
 * @returns 等级 0-4
 */
function getLevelFromCount(count: number): number {
  if (count === 0) return 0
  if (count <= 3) return 1
  if (count <= 6) return 2
  if (count <= 9) return 3
  return 4
}

/**
 * 通过 GitHub REST API 获取用户的仓库列表
 * 筛选出标记为 pinned 的仓库（通过 topics 判断）
 * 如果无法判断 pinned，则返回 star 数最多的仓库
 *
 * @param username - GitHub 用户名
 * @returns 仓库数据数组
 */
export async function fetchGitHubRepos(username: string): Promise<RepoData[]> {
  const cacheKey = `repos_${username}`
  const cached = getCached<RepoData[]>(cacheKey)
  if (cached) return cached

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  }

  const token = import.meta.env.VITE_GITHUB_TOKEN as string | undefined
  if (token) {
    headers.Authorization = `bearer ${token}`
  }

  /* 获取用户的仓库列表，按 star 数排序，取前 100 个 */
  const response = await fetch(
    `https://api.github.com/users/${username}/repos?sort=stars&per_page=100&type=owner`,
    { headers },
  )

  if (!response.ok) {
    throw new Error(`GitHub REST 请求失败: ${response.status}`)
  }

  const repos = await response.json()

  /* 尝试通过 GraphQL 获取 pinned repositories */
  let pinnedNames: string[] = []
  try {
    pinnedNames = await fetchPinnedRepoNames(username, headers)
  } catch {
    /* 如果获取 pinned 失败，降级为按 star 排序的前 6 个 */
  }

  let filtered: typeof repos
  if (pinnedNames.length > 0) {
    /* 根据 pinned 名称过滤 */
    filtered = repos.filter((r: { name: string }) =>
      pinnedNames.includes(r.name),
    )
  } else {
    /* 降级：取 star 数最多的前 6 个非 fork 仓库 */
    filtered = repos
      .filter((r: { fork: boolean }) => !r.fork)
      .slice(0, 6)
  }

  const result: RepoData[] = filtered.map(
    (repo: {
      name: string
      description: string | null
      language: string | null
      stargazers_count: number
      forks_count: number
      html_url: string
      fork: boolean
    }) => ({
      name: repo.name,
      description: repo.description,
      language: repo.language,
      stargazerCount: repo.stargazers_count,
      forkCount: repo.forks_count,
      url: repo.html_url,
      isFork: repo.fork,
      languageColor: getLanguageColor(repo.language),
    }),
  )

  setCache(cacheKey, result)
  return result
}

/**
 * 通过 GraphQL 获取用户的 pinned 仓库名称列表
 * @param username - GitHub 用户名
 * @param headers - 请求头（含认证信息）
 * @returns pinned 仓库名称数组
 */
async function fetchPinnedRepoNames(
  username: string,
  headers: Record<string, string>,
): Promise<string[]> {
  const token = import.meta.env.VITE_GITHUB_TOKEN as string | undefined
  if (!token) return []

  const query = `
    query($username: String!) {
      user(login: $username) {
        pinnedItems(first: 6) {
          nodes {
            ... on Repository {
              name
            }
          }
        }
      }
    }
  `

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { username } }),
  })

  if (!response.ok) return []

  const json = await response.json()
  const nodes = json.data?.user?.pinnedItems?.nodes ?? []
  return nodes
    .map((n: { name?: string }) => n.name)
    .filter((n: string | undefined): n is string => !!n)
}
