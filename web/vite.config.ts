// Vite 构建工具配置
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    react(), // React 插件，支持 JSX 转换和快速刷新
    tailwindcss(), // Tailwind CSS v4 插件，使用 @tailwindcss/vite 集成
  ],
  resolve: {
    alias: {
      // 路径别名：@/ 指向 src/ 目录
      "@": "/src",
    },
  },
})
