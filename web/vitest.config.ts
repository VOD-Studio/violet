// Vitest 测试配置（从 vite.config.ts 分离，避免 Vite 8 / Vitest 2 类型冲突）
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 测试环境
    environment: "jsdom",
    // 全局 setup（jest-dom 匹配器）
    setupFiles: ["./src/test-setup.ts"],
    // 包含/排除（alias 继承 vite.config.ts 中的 resolve.alias）
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
