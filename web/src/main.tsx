/**
 * 应用入口文件
 * 挂载根组件到 DOM 节点
 */

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "@/App"
import "@/index.css"

// 挂载根组件到 DOM 节点
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
