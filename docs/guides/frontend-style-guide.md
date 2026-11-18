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

没有标准类时可以用任意值（如 `w-[73px]`）。界面颜色使用语义 token，不把可替换的品牌色板写成组件或页面里的固定色值。

类名 canonical 形式（important 后缀、负零消除、逻辑属性改名等）见 `.agents/skills/tailwind-canonical-classes`。

## 站点视觉与焦点

- 功能控件的圆角上限为 `rounded-2xl`（16px）；胶囊用 `rounded-full`，不受这个上限约束。
- 浮起只用偏移 `0 4px`、模糊 `24px`、透明度 `5%` 的软影，不用硬投影。暗色下可用 `ring-1 ring-border` 补充分界；描边本身不表示浮起。
- 输入框和按钮的聚焦环不能被滚动区或折叠层裁掉。裁剪层可留至少 4px 内边距并用等量负外边距抵消（`-m-1 p-1`），也可只裁剪不含可聚焦控件的内层。抽屉和气泡的滚动区同样要留水平余量。

改动含可聚焦控件的裁剪容器后，在实际页面依次用 Tab 和点击聚焦控件，检查四边的环都完整。页面组合已有组件时，不为贴合旧页面稿改写控件；优先级见 [ADR-0030](../adr/0030-frontend-pages-use-existing-components.md)。

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

分层与依赖方向见根规范的[架构耦合约束](../../AGENTS.md#架构耦合约束)。feature 内部的实际形态：

```
features/<name>/
├── api/        # client.ts(端点函数) / queries.ts(Query hooks) / keys.ts(query key 工厂)
├── model/      # types.ts(命名 interface DTO)、领域状态
├── ui/         # 组件，平铺；__tests__/ 就近放
└── hooks/      # 按需创建（feature 私有 hooks）
```

- 组件平铺在 `ui/` 下，不建 per-component 子目录；只有 data-table 这类多文件复合组件才有 `components/`、`hooks/`、`utils/`、`styles/` 子目录。
- 新 feature 的装配顺序与文件清单见 `.agents/skills/module-scaffolding`。
