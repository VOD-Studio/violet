/**
 * middleware/auth 路由守卫测试
 *
 * 验证 adminLoader/authLoader 的认证检查逻辑
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/store";

// 动态 import 避免模块加载时的 store 状态污染
async function loadGuards() {
  // auth.ts 用 useAuthStore.getState()，需先设置 store 再 import
  return await import("@/middleware/auth");
}

describe("路由守卫", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("adminLoader: 未认证时应返回 redirect 到 /login", async () => {
    const { adminLoader } = await loadGuards();
    const result = adminLoader();
    // redirect() 返回 Response 对象
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
  });

  it("adminLoader: 已认证且有 admin:access 权限时应返回 null", async () => {
    useAuthStore.getState().setAuth("token", "refresh", 3600, undefined, {
      id: "1",
      username: "admin",
      email: "admin@x.com",
      permissions: ["admin:access"],
    });
    const { adminLoader } = await loadGuards();
    const result = adminLoader();
    expect(result).toBeNull();
  });

  it("adminLoader: 已认证但无 admin:access 权限时应 redirect", async () => {
    useAuthStore.getState().setAuth("token", "refresh", 3600, undefined, {
      id: "1",
      username: "user",
      email: "user@x.com",
      permissions: [],
    });
    const { adminLoader } = await loadGuards();
    const result = adminLoader();
    expect(result).toBeInstanceOf(Response);
  });

  it("adminLoader: token 过期时应 redirect", async () => {
    useAuthStore.getState().setAuth("token", "refresh", -100); // 已过期
    const { adminLoader } = await loadGuards();
    const result = adminLoader();
    expect(result).toBeInstanceOf(Response);
  });

  it("authLoader: 未认证时应 redirect", async () => {
    const { authLoader } = await loadGuards();
    const result = authLoader();
    expect(result).toBeInstanceOf(Response);
  });

  it("authLoader: 已认证时应返回 null", async () => {
    useAuthStore.getState().setAuth("token", "refresh", 3600);
    const { authLoader } = await loadGuards();
    const result = authLoader();
    expect(result).toBeNull();
  });
});
