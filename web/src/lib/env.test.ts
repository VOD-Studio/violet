/**
 * env.ts 环境变量模块测试
 *
 * 验证 requireEnv/optionalEnv 行为：
 * - 必需变量缺失抛错
 * - 可选变量缺失返回 fallback
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("env 模块", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("VITE_API_URL 缺失时应抛错", async () => {
    vi.stubEnv("VITE_API_URL", "");
    await expect(async () => {
      await import("@/lib/env");
    }).rejects.toThrow("Missing required environment variable: VITE_API_URL");
  });

  it("正确读取必需变量", async () => {
    vi.stubEnv("VITE_API_URL", "http://localhost:8080/api/v1");
    vi.stubEnv("VITE_SERVER_ORIGIN", "");
    vi.stubEnv("VITE_SITE_URL", "");
    const { env } = await import("@/lib/env");
    expect(env.apiUrl).toBe("http://localhost:8080/api/v1");
  });

  it("可选变量缺失时使用 fallback", async () => {
    vi.stubEnv("VITE_API_URL", "http://localhost:8080/api/v1");
    vi.stubEnv("VITE_SERVER_ORIGIN", "");
    vi.stubEnv("VITE_SITE_URL", "");
    const { env } = await import("@/lib/env");
    expect(env.serverOrigin).toBe("http://localhost:8080");
    expect(env.siteUrl).toBe("http://localhost:5173");
  });

  it("可选变量有值时使用实际值", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com/v1");
    vi.stubEnv("VITE_SERVER_ORIGIN", "https://api.example.com");
    vi.stubEnv("VITE_SITE_URL", "https://example.com");
    const { env } = await import("@/lib/env");
    expect(env.apiUrl).toBe("https://api.example.com/v1");
    expect(env.serverOrigin).toBe("https://api.example.com");
    expect(env.siteUrl).toBe("https://example.com");
  });
});
