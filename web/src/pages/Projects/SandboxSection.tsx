import type { SandboxFile } from "@/components/blog/CodeSandbox"
import { CodeSandbox } from "@/components/blog/CodeSandbox"
import { ScrollReveal } from "@/components/creative"

const SANDBOX_FILES: SandboxFile[] = [
  {
    path: "/App.tsx",
    code: `import { useState } from "react"

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
        React 计数器
      </h1>
      <p style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
        当前计数: {count}
      </p>
      <button
        onClick={() => setCount(count + 1)}
        style={{
          padding: "0.5rem 1.5rem",
          fontSize: "1rem",
          borderRadius: "0.5rem",
          border: "none",
          background: "#3b82f6",
          color: "white",
          cursor: "pointer",
        }}
      >
        点击 +1
      </button>
    </div>
  )
}`,
    active: true,
  },
]

export function SandboxSection() {
  return (
    <section className="mt-16">
      <ScrollReveal animation="fadeUp">
        <h2 className="mb-2 text-2xl font-bold">在线代码沙盒</h2>
        <p className="mb-6 text-muted-foreground">
          无需搭建本地环境，直接在浏览器中体验代码运行效果。
        </p>
      </ScrollReveal>

      <ScrollReveal animation="fadeIn" delay={0.2}>
        <CodeSandbox
          files={SANDBOX_FILES}
          height={420}
          showConsole={false}
        />
      </ScrollReveal>
    </section>
  )
}