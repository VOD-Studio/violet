/**
 * 应用入口文件
 * 挂载根组件到 DOM 节点，配置 React Query + 主题提供者
 */

import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import QueryProvider from "@/components/providers/QueryProvider";
import "@/index.css";

// 挂载根组件到 DOM 节点
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      {/* 主题：class 策略（在 <html> 加 .light/.dark），与 index.css 的 @custom-variant dark 一致 */}
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <App />
      </ThemeProvider>
    </QueryProvider>
  </StrictMode>,
);
