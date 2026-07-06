import { createServerFn } from "@tanstack/react-start";
import type { SessionClaims } from "../../features/auth/model/types";
import { getServerHttpClient } from "./auth";

/**
 * getCurrentSession - 获取当前登录会话 Claims（server function）
 *
 * 转发浏览器 cookie 到后端 GET /auth/session：
 * - cookie 有效 → 返回 SessionClaims
 * - cookie 无效/缺失 → 返回 null
 */
export const getCurrentSession = createServerFn({ method: "GET" }).handler(
    async (): Promise<SessionClaims | null> => {
        try {
            const client = getServerHttpClient();
            const res = await client.get<{ data: SessionClaims }>("/auth/session");
            return res.data.data;
        } catch {
            return null;
        }
    },
);
