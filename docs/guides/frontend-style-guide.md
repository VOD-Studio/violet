# 前端代码规范

## Tailwind CSS

### 使用标准间距类名，避免任意值

```tsx
// ❌ 任意值（方括号语法）
className="after:right-[-6px] after:w-[18px]"
className="p-[24px] m-[32px]"

// ✅ 标准类名
className="after:-right-1.5 after:w-4.5"
className="p-6 m-8"
```

任意值绕过 Tailwind 的工具类复用，产生一次性 CSS。间距对照：`0.5`=2px、`1`=4px、`1.5`=6px、`2`=8px、`2.5`=10px、`3`=12px、`3.5`=14px、`4`=16px、`4.5`=18px、`5`=20px、`6`=24px、`8`=32px、`10`=40px、`12`=48px。

可用任意值的场景：品牌色（`bg-[#1DA1F2]`）、确实无标准值（`w-[73px]`）、CSS 变量（`bg-[var(--custom-color)]`）。

类名 canonical 形式（important 后缀、负零消除、逻辑属性改名等）见 `.agents/skills/tailwind-canonical-classes`。

## React

组件用 `export function` 声明；组件内部函数用箭头函数。Hooks 回调内联箭头保持一致：

```tsx
export function MyComponent() {
	const handleClick = () => {
		// ...
	};

	return <button onClick={handleClick}>Click</button>;
}
```

## 目录结构（Feature-Sliced Design）

分层与依赖方向见根 AGENTS.md「架构耦合约束」。feature 内部的实际形态：

```
features/<name>/
├── api/        # client.ts(端点函数) / queries.ts(Query hooks) / keys.ts(query key 工厂)
├── model/      # types.ts(命名 interface DTO)、领域状态
├── ui/         # 组件，平铺；__tests__/ 就近放
└── hooks/      # 按需创建（feature 私有 hooks）
```

- 组件平铺在 `ui/` 下，不建 per-component 子目录；只有 data-table 这类多文件复合组件才有 `components/`、`hooks/`、`utils/`、`styles/` 子目录。
- 新 feature 的装配顺序与文件清单见 `.agents/skills/module-scaffolding`。
