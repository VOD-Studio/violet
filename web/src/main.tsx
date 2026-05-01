/**
 * 应用入口文件
 * 挂载根组件到 DOM 节点，配置 React Query 全局提供者
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import QueryProvider from "@/components/providers/QueryProvider";
import App from "@/App";
import "@/index.css";

// 挂载根组件到 DOM 节点
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
);
