/**
 * auth store 测试
 *
 * 验证认证状态管理：setAuth/clearAuth/setUser、token 过期判断
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/store";

describe("useAuthStore", () => {
  beforeEach(() => {
    // 每个测试前重置 store
    useAuthStore.getState().clearAuth();
  });

  it("初始状态应为未认证", () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it("setAuth 应正确设置 token 和过期时间", () => {
    const now = Date.now();
    useAuthStore.getState().setAuth(
      "access-token",
      "refresh-token",
      900, // 15 分钟
      604800, // 7 天
      { id: "user-1", username: "test", email: "test@example.com" },
    );

    const state = useAuthStore.getState();
    expect(state.token).toBe("access-token");
    expect(state.refreshToken).toBe("refresh-token");
    expect(state.expiresAt).toBeGreaterThan(now);
    expect(state.refreshExpiresAt).toBeGreaterThan(state.expiresAt ?? 0);
    expect(state.user?.username).toBe("test");
  });

  it("clearAuth 应清除所有认证信息", () => {
    useAuthStore.getState().setAuth("token", "refresh", 900, undefined, {
      id: "1",
      username: "u",
      email: "e@x.com",
    });
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.expiresAt).toBeNull();
    expect(state.user).toBeNull();
  });

  it("setUser 应更新用户信息但保留 token", () => {
    useAuthStore.getState().setAuth("token", "refresh", 900);
    useAuthStore.getState().setUser({
      id: "1",
      username: "updated",
      email: "new@x.com",
    });

    const state = useAuthStore.getState();
    expect(state.token).toBe("token");
    expect(state.user?.username).toBe("updated");
  });

  it("setAuth 不传 user 时 user 保持 null", () => {
    useAuthStore.getState().setAuth("token", "refresh", 900);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("过期时间应正确计算", () => {
    const before = Date.now();
    useAuthStore.getState().setAuth("t", "r", 1000); // 1000 秒
    const after = Date.now();
    const state = useAuthStore.getState();

    // expiresAt 应在 before+1000s 到 after+1000s 之间
    expect(state.expiresAt).toBeGreaterThanOrEqual(before + 1000 * 1000 - 10);
    expect(state.expiresAt).toBeLessThanOrEqual(after + 1000 * 1000 + 10);
  });
});
