/**
 * 环境变量校验与访问
 */

function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  apiUrl: requireEnv("VITE_API_URL"),
  githubToken: import.meta.env.VITE_GITHUB_TOKEN ?? "",
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === "true",
} as const;
