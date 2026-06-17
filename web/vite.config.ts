// Vite 构建工具配置
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** 依赖包名 -> chunk 名称映射 */
const CHUNK_MAP: Record<string, string> = {
  react: "react-vendor",
  "react-dom": "react-vendor",
  "react-router": "react-vendor",
  zustand: "state-vendor",
  "@tanstack/react-query": "state-vendor",
  "@tiptap/react": "editor-vendor",
  "@tiptap/starter-kit": "editor-vendor",
  "@tiptap/pm": "editor-vendor",
  aplayer: "music-vendor",
  plyr: "music-vendor",
  "plyr-react": "music-vendor",
  "lucide-react": "icons-vendor",
  motion: "motion-vendor",
};

export default defineConfig({
  plugins: [
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
        manualChunks(id: string) {
          // 从模块路径中提取包名
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
