import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  // TanStack Start 的 #tanstack-{router,start}-entry 是插件运行时注册的虚拟模块，
  // 不能进入 rolldown 依赖优化（rolldown 把它当真实包解析失败）。
  // 排除所有 TanStack 内部包，让 plugin 自己处理这些模块。
  optimizeDeps: {
    exclude: [
      '@tanstack/createServerFn',
      '@tanstack/start-server-core',
      '@tanstack/start-plugin-core',
      '@tanstack/react-start',
      '@tanstack/react-start-server',
      '@tanstack/react-start-client',
      '@tanstack/server-functions-plugin',
    ],
  },
})

export default config
