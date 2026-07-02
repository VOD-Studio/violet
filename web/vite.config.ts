import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// 读取 .env / .env.local，使 dev 反向代理目标可配置，不污染已提交文件
const env = loadEnv("development", process.cwd(), "");
const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:9090";

const config = defineConfig({
    resolve: { tsconfigPaths: true },
    plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
    // dev 反向代理：浏览器同源请求 /api/* 和 /uploads/* 由 Vite 转发到 Go 后端，
    // 目标地址可通过 VITE_API_PROXY_TARGET 配置，默认 localhost:9090。
    // 与生产 nginx 反代行为一致（避免 dev 时跨域 Cookie/CSRF 边界问题）。
    // SSR 路径不走这里——服务端用 VITE_SSR_API_BASE_URL 直连后端。
    server: {
        proxy: {
            "/api": {
                target: apiProxyTarget,
                changeOrigin: true,
            },
            "/uploads": {
                target: apiProxyTarget,
                changeOrigin: true,
            },
        },
    },
    // TanStack Start 的 #tanstack-{router,start}-entry 是插件运行时注册的虚拟模块，
    // 不能进入 rolldown 依赖优化（rolldown 把它当真实包解析失败）。
    // 排除所有 TanStack 内部包，让 plugin 自己处理这些模块。
    optimizeDeps: {
        exclude: [
            "@tanstack/createServerFn",
            "@tanstack/start-server-core",
            "@tanstack/start-plugin-core",
            "@tanstack/react-start",
            "@tanstack/react-start-server",
            "@tanstack/react-start-client",
            "@tanstack/server-functions-plugin",
        ],
    },
});

export default config;
