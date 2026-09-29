## 组件内置动效

`@violet/ui` 的组件动效全部由 Tailwind 工具类承载：交互态走 `transition-[color,background-color,border-color,box-shadow,opacity,filter] duration-150 ease-out` 一类的显式属性清单，入场与循环动效走包内注册的 `--animate-*` token。当前包内可用的动画 token：

| Token | 效果 | 典型用途 |
| --- | --- | --- |
| `animate-caret-blink` | 1s 光标闪烁 | 输入类组件的插字符 |
| `animate-diagram-enter` | 0.25s ease-out 淡入 | 图表/示意进入 |
| `animate-tab-panel-in` | 0.2s ease-out 面板进入 | Tabs 面板切换 |
| `animate-marquee` | 40s 线性循环 | 跑马灯横滚 |
| `animate-blob` / `animate-nexus-shimmer` | 品牌氛围动效 | 站点装饰层 |

交互反馈类过渡（悬停显现、复制回显、指示线滑动）不走 keyframes，统一引用 `--transition-feedback`（160ms ease-out，`@violet/ui/styles.css` 的 theme 层注册）。
组件不暴露独立的动画状态属性（`data-entering` 之类）；进入/退出态由 Radix 的 `data-[state=open]` 等 Radix 状态选择器配合 `motion` 组件处理。

## 用 Tailwind 写动画

动画时长、缓动、延迟直接用 Tailwind v4 工具类表达，并成对提供减弱动态降级：

```tsx
// 悬停脉冲，减弱动态时静止
<Button className="hover:animate-pulse motion-reduce:animate-none">保存</Button>

// 列表错峰入场
<div className="space-y-2">
	<Card className="animate-tab-panel-in motion-reduce:animate-none">第一项</Card>
	<Card className="animate-tab-panel-in [animation-delay:100ms] motion-reduce:animate-none">
		第二项
	</Card>
</div>
```

动效章程的底线：常规状态反馈用颜色、描边、阴影与透明度表达，非必要不使用 `scale`，非必要不使用方向性滑入滑出。完整判据见[动效章程](/design-system/motion)。

## 与 motion 协作

包与 `motion`（Framer Motion 后继）直接组合：

```tsx
import { motion } from "motion/react";
import { Button } from "@violet/ui";

const MotionButton = motion(Button);

<MotionButton whileHover={{ opacity: 0.85 }} whileTap={{ opacity: 0.7 }}>
	提交
</MotionButton>
```

选中态的滑动指示器用共享布局实现——只在选中项内渲染 `motion.span` 并挂 `layoutId`，motion 会在项间弹簧搬运：

```tsx
{isSelected && (
	<motion.span
		layoutId="category-pill"
		className="absolute inset-0"
		transition={{ type: "spring", stiffness: 420, damping: 38 }}
	/>
)}
```

`AnimatePresence` 用于卸载动画（抽屉、对话框退出）。

## 尊重减弱动态

三层配合：

1. CSS 侧用 Tailwind 的 `motion-reduce:` 变体逐条降级（见上例）。
2. `motion` 组件的弹簧动画不会被自动降级，须显式判断：

```tsx
import { useReducedMotion } from "motion/react";

const shouldReduce = useReducedMotion();
<motion.span
	transition={shouldReduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38 }}
/>;
```

3. 基于雪碧图的逐帧动画停在末帧。

## 性能要点

- 只动画 `transform` 与 `opacity`；`left/top/width/height` 触发布局，改用 transform 合成。
- FLIP 技术处理尺寸/位置变化：瞬时布局 + WAAPI transform 补间，避免逐帧 reflow。
- `will-change` 只在动画进行时挂，动画结束移除；常驻 `will-change` 白占显存。
- 长列表动画错峰用 `animation-delay`，不用 JS 逐项计时器。
