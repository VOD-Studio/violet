// 文章内容解析工具
// 解析 HTML 内容中的沙盒标记，支持嵌入 CodeSandbox

import type { SandboxFile } from "@/components/blog/CodeSandbox";

/** 沙盒标记正则，匹配 ::sandbox[id]:: 或 ::sandbox[id]{description}:: */
export const SANDBOX_MARKER = /::sandbox\[([^\]]+)\](?:\{([^}]*)\})?::/g;

/** 沙盒预设数据，实际项目中可从 API 获取 */
export const SANDBOX_PRESETS: Record<
  string,
  { files: SandboxFile[]; description?: string }
> = {
  "react-counter": {
    files: [
      {
        path: "/App.tsx",
        code: `import { useState } from "react"

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>React 计数器示例</h1>
      <p style={{ fontSize: "1.5rem" }}>当前计数: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>
        点击 +1
      </button>
    </div>
  )
}`,
        active: true,
      },
    ],
    description: "一个简单的 React 计数器组件",
  },
  "useEffect-demo": {
    files: [
      {
        path: "/App.tsx",
        code: `import { useState, useEffect } from "react"

export default function App() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>useEffect 定时器示例</h1>
      <p style={{ fontSize: "2rem", fontVariantNumeric: "tabular-nums" }}>
        {seconds} 秒
      </p>
    </div>
  )
}`,
        active: true,
      },
    ],
    description: "演示 useEffect 的清理函数用法",
  },
};

/** 解析后的内容片段类型 */
export type ContentPart =
  | { type: "html"; content: string }
  | { type: "sandbox"; id: string; description?: string };

/**
 * 解析文章内容，在沙盒标记位置插入 CodeSandbox 组件
 * @param html 原始 HTML 内容
 */
export function parseContentWithSandboxes(html: string): ContentPart[] {
  if (!html) return [{ type: "html", content: "" }];

  const parts: ContentPart[] = [];
  let lastIndex = 0;

  for (const match of html.matchAll(SANDBOX_MARKER)) {
    /* 添加标记之前的 HTML 内容 */
    if (match.index > lastIndex) {
      parts.push({ type: "html", content: html.slice(lastIndex, match.index) });
    }

    /* 添加沙盒标记 */
    parts.push({
      type: "sandbox",
      id: match[1],
      description: match[2] || undefined,
    });

    lastIndex = match.index + match[0].length;
  }

  /* 添加剩余的 HTML 内容 */
  if (lastIndex < html.length) {
    parts.push({ type: "html", content: html.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "html", content: html }];
}
