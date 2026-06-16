// 个人中心 (/profile) — 待迁移
//
// 守卫：未登录跳转 /login。用 TanStack Router 的 beforeLoad + redirect 实现，
// 替代原 react-router 的渲染式 <Navigate>。

import { createFileRoute, redirect } from "@tanstack/react-router";
import { Placeholder } from "@/components/Placeholder";
import { useAuthStore } from "@/store";

export const Route = createFileRoute("/_public/profile")({
  beforeLoad: () => {
    const { token, expiresAt } = useAuthStore.getState();
    const isAuthenticated = !!token && (!expiresAt || expiresAt >= Date.now());
    if (!isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Placeholder title="个人中心" path="/profile" />,
});
