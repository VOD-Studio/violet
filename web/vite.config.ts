// Vite 构建工具配置
//
// 注：Vitest 配置已抽离到独立的 vitest.config.ts（mergeConfig 合并本文件），
// 避免在 vite defineConfig 类型签名上引入 vitest/config 的旧 vite 类型。
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** 依赖包名 -> chunk 名称映射（兼容 pnpm .pnpm 虚拟存储布局） */
const CHUNK_MAP: Record<string, string> = {
  react: "react-vendor",
  "react-dom": "react-vendor",
  "@tanstack/react-router": "router-vendor",
  zustand: "state-vendor",
  "@tanstack/react-query": "state-vendor",
  "@tiptap/react": "editor-vendor",
  "@tiptap/starter-kit": "editor-vendor",
  aplayer: "music-vendor",
  plyr: "music-vendor",
  "plyr-react": "music-vendor",
  "lucide-react": "icons-vendor",
  motion: "motion-vendor",
  three: "three-vendor",
  "@react-three/fiber": "three-vendor",
  "@react-three/drei": "three-vendor",
};

export default defineConfig({
  plugins: [
    // TanStack Router 文件路由代码生成插件 —— 必须放在最前（react 之前），
    // 否则构建期 routeTree.gen.ts 生成会失败（见 issue #4912）
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(), // React 插件，支持 JSX 转换和快速刷新
    tailwindcss(), // Tailwind CSS v4 插件
  ],
  resolve: {
    alias: {
      // 路径别名：@/ 指向 src/ 目录
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    // 生产构建目标
    target: "es2020",
    // 输出目录
    outDir: "dist",
    // 启用 sourcemap（生产排障用，可按需关闭减小体积）
    sourcemap: false,
    // chunk 大小警告阈值（KB）
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // 手动分包策略：将大依赖拆分为独立 chunk，优化缓存命中率
        // 使用函数形式以兼容 pnpm 的 .pnpm/<pkg>/node_modules/<pkg> 虚拟存储布局
        manualChunks(id: string) {
          const match = id.match(
            /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?(?<pkg>@[^/]+\/[^/]+|[^/]+)\//,
          );
          const pkg = match?.groups?.pkg;
          if (pkg) {
            return CHUNK_MAP[pkg];
          }
        },
      },
    },
  },
});

