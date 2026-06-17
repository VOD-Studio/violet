// Vite 构建工具配置
//
// 2.0 SSR：迁移到 TanStack Start（基于 Vite + Nitro）。
// @tanstack/react-start/plugin/vite 的 tanstackStart() 接管 SSR 渲染管线，
// nitro() 提供服务端运行时。manualChunks 已移除（Nitro 自行组织产物）。
//
// 注：Vitest 配置在独立的 vitest.config.ts（mergeConfig 合并本文件）。
import { resolve } from "node:path";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      // 路径别名：@/ 指向 src/ 目录
      "@": resolve(__dirname, "src"),
    },
  },
  plugins: [
    tailwindcss(),
    // TanStack Start：内部已包含 router 文件路由代码生成 + autoCodeSplitting + SSR
    // 不再单独加 tanstackRouter()（会与 Start 的代码生成冲突，导致 TSRSplitComponent 未定义）
    tanstackStart({
      srcDirectory: "src",
    }),
    react(),
    // Nitro 服务端运行时：生产输出 .output/server/index.mjs
    nitro(),
  ],
});

