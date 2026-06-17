// Vite 构建工具配置
//
// 注：test 字段属于 Vitest 配置。项目用 vitest@2（依赖 vite v5 类型），
// 与当前 vite@7 类型不完全兼容，故 test 配置以独立常量 + 合并的方式注入，
// 避免在 defineConfig 类型签名上引入 vitest/config 的旧 vite 类型。
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

// Vitest 配置（运行时由 vitest 读取，类型上单独声明避免与 vite defineConfig 冲突）
const vitestConfig = {
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/store/**", "src/middleware/**"],
    },
  },
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
  ...vitestConfig,
} as ReturnType<typeof defineConfig>);
