/**
 * 环境变量校验与访问
 *
 * 单一事实来源：所有 import.meta.env 读取都应通过本模块的 env 对象，
 * 而非散落在各文件直接访问 import.meta.env.VITE_XXX。
 * 这样：
 * 1. 缺失必需变量时在启动时立即报错（fail fast）
 * 2. 类型安全（env 对象有明确类型）
 * 3. 集中文档化所有用到的环境变量
 */

/**
 * 读取必需环境变量，缺失则抛错
 * 私有函数，仅本模块内部使用
 */
function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * 读取可选环境变量，缺失或空字符串返回 fallback
 */
function optionalEnv(key: string, fallback = ""): string {
  const value = import.meta.env[key];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return value as string;
}

/**
 * 应用全局环境配置
 *
 * 所有环境变量通过此对象访问，禁止在其它文件直接用 import.meta.env。
 */
export const env = {
  /** 后端 API 基础地址（含 /api/v1 前缀），如 http://localhost:8080/api/v1 */
  apiUrl: requireEnv("VITE_API_URL"),
  /** 服务器根地址（不含 API 前缀），用于拼接上传文件等静态资源 URL */
  serverOrigin: optionalEnv("VITE_SERVER_ORIGIN", "http://localhost:8080"),
  /** 站点公开访问 URL（SEO、og 标签用），如 https://example.com */
  siteUrl: optionalEnv("VITE_SITE_URL", "http://localhost:5173"),
  /** GitHub Token（用于贡献数据获取） */
  githubToken: optionalEnv("VITE_GITHUB_TOKEN"),
  /** 是否启用站点分析 */
  enableAnalytics: optionalEnv("VITE_ENABLE_ANALYTICS") === "true",
} as const;
