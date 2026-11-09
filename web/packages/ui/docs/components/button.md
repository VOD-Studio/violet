# Button

触发一个操作。六种变体从强到弱：主要 primary、次要 secondary（默认）、描边 outline、幽灵 ghost、危险 destructive、链接 link。三档尺寸 32 / 36 / 40（触屏各加 4），与输入框同高，放在同一行能对齐。按钮是药丸形；仅图标按钮是正圆且必须有 `aria-label`。

```tsx
import { Button } from "@violet/ui";

<Button variant="primary" type="submit">发布</Button>
<Button variant="ghost" size="sm" leftIcon={<Plus aria-hidden="true" />}>添加</Button>
<Button variant="ghost" iconOnly aria-label="关闭"><X aria-hidden="true" /></Button>
```

## API

| 属性 | 作用 |
| --- | --- |
| `variant` | `primary` / `secondary`（默认）/ `outline` / `ghost` / `destructive` / `link` |
| `size` | `sm` 32 / `md` 36（默认）/ `lg` 40；`pointer: coarse` 下各加 4 |
| `iconOnly` | 正圆形纯图标按钮；必须提供 `aria-label`，文字提示不能代替它 |
| `leftIcon` / `rightIcon` | 前置图标表示动作，后置箭头表示展开或跳转；对读屏隐藏，不进入名称 |
| `loading` | `aria-busy="true"`、仍可聚焦、点击与键盘激活被忽略；指示器盖在内容中央，宽度不变 |
| `loadingText` | 加载时替换正文（「发布中…」），宽度跟随新文案；iconOnly 下不生效 |
| `done` / `doneDuration` | 完成后的结果文案（「已保存」）：展示 `doneDuration`（默认 1600ms）后回到 children；期间可点击 |
| `asChild` | 属性与 ref 合并到唯一子元素（自定义 Link）；加载时子元素不被禁用，只标 `aria-busy` 并拦截激活 |
| `type` | 默认 `type="button"`；表单主操作显式写 `submit` |
| `disabled` | 原生 `disabled`，跳出 Tab 顺序，整体 42% 透明；要解释为什么不能点时改用可聚焦按钮并在旁边说明 |
| `ref` / `className` | 原生模式指向 button；asChild 模式指向子元素 |

## 变体与用量

一组操作只有一个主要按钮（primary），放在最右；次要（secondary）放它左边。outline 需要有边界但不抢眼，放在灰底面板上比次要清楚。ghost 用于工具栏与卡片里的轻操作，悬停才出现底色。destructive 只出现在确认框里做最后一步，不直接摆在列表上。link 外观是链接，语义仍是按钮；导航到另一个页面请用真正的链接。

## 状态

- 悬停与按下只改底色，不缩放不位移。
- 聚焦环 2px 强调色、距按钮 2px，只在 `focus-visible` 时出现，出现与消失不做动画。
- 加载：按钮宽度不变，指示器 120ms 淡入、文字同时淡出；前置图标时指示器替换图标、原位置保留；`loadingText` 时宽度跟着变。
- 完成：`done` 文字与对勾直接换入、120ms 淡入，之后回到 children。
- 禁用 42% 透明，原生 `disabled`。

## 样式规格（与设计稿一致）

| 变体 | 底 | 悬停 | 按下 |
| --- | --- | --- | --- |
| primary | 墨色底、纸色字 | 混 14% 纸色 | 混 24% |
| secondary | 凹陷色底 | 混 10% 墨色 | 混 18% |
| outline | 纸色底 + 1px 墨色 22% 细环 | 细环换焦点色 | 底色变凹陷色 |
| ghost | 无底 | 凹陷色底 | 再深 |
| destructive | 12% 危险色混纸色底、危险色字 | 18% | 24% |
| link | 强调色字 + 40% 下划线 | 下划线实线 | 70% 透明 |

尺寸：高度 32 / 36 / 40；内边距左右 12 / 16 / 16；字号 14 / 14 / 16、字重 500；图标 16 / 16 / 20、线宽 1.75、与文字间距 8。图标按钮宽等于高。触屏（`pointer: coarse`）高度各加 4。

## 动效

悬停底色 140ms ease-out；按下底色加深 60ms、松开 140ms 回来；加载指示器与完成对勾 120ms 淡入；聚焦环不做动画。减弱动态（系统偏好与 `[data-motion="reduce"]` 作用域）下指示器停止旋转、保留静止弧线，所有过渡静止。

## 键盘与读屏

Enter 与 Space 都能触发；`aria-busy="true"` 时读屏读出「忙碌」，按钮仍可聚焦；禁用跳出 Tab 顺序。作为弹出层触发器时（`aria-expanded="true"` / `data-state="open"`），面板打开期间保持悬停底色。

## 导入

React 从 `@violet/ui` 或 `@violet/ui/button` 导入；`buttonVariants` 从 `@violet/ui/variants`。按需 CSS 使用 `@violet/ui/components/button.css`。
