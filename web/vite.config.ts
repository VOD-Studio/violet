// Vite 构建工具配置
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
        manualChunks: {
          // React 核心（react + react-dom + react-router）
          "react-vendor": ["react", "react-dom", "react-router"],
          // 状态管理（zustand + tanstack-query）
          "state-vendor": ["zustand", "@tanstack/react-query"],
          // 富文本编辑器（tiptap 全家桶，体积大）
          "editor-vendor": [
            "@tiptap/react",
            "@tiptap/starter-kit",
            "@tiptap/pm",
          ],
          // 音乐播放器（aplayer + plyr，体积大）
          "music-vendor": ["aplayer", "plyr", "plyr-react"],
          // 图标库
          "icons-vendor": ["lucide-react"],
          // 动画
          "motion-vendor": ["motion"],
        },
      },
    },
  },
  // 测试配置（Vitest）
  test: {
    // 测试环境
    environment: "jsdom",
    // 全局 setup（jest-dom 匹配器）
    setupFiles: ["./src/test-setup.ts"],
    // 包含/排除（alias 继承 vite resolve.alias）
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist"],
    // coverage 配置
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/store/**", "src/middleware/**"],
    },
  },
});
