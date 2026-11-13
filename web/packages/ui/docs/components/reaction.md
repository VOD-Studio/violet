# ReactionBar 回应条

`ReactionBar` 展示宿主持有的回应集合，并负责名单提示、折叠、快捷选择与添加面板的形变接力。API 请求、登录、最近记录、表情目录和乐观更新都不进入 SDK。

## 公开入口

```tsx
import {
	ReactionBar,
	type ReactionBarProps,
	type ReactionItem,
	type ReactionUser,
} from "@violet/ui/reaction";
```

单元只导出上述组件和类型。完整样式入口为 `@violet/ui/styles.css`；按需 CSS 先加载 `@violet/ui/tokens.css`，再加载 `@violet/ui/components/reaction.css`。回应单元的 CSS 包含 MorphingPopover、Tooltip 和 ListHighlight 的样式依赖。`renderPicker` 的内容由宿主提供，其样式仍由对应单元提供，例如 EmojiPickerPanel 的叶子 CSS。

```ts
interface ReactionUser {
	name: string;
	self?: boolean;
}

interface ReactionItem {
	id: string;
	name: string;
	content: ReactNode;
	count: number;
	self: boolean;
	recentUsers?: readonly ReactionUser[];
}
```

`id` 是稳定、不透明的键：同一表情在 `items`、`recentItems` 和完整选择器里必须使用相同 ID。组件不解析数字 ID、占位符或业务前缀。`content` 原样渲染，图片可以是 GIF；颜文字传字符串可获得 12px 与最长 56px 的文字处理。

| 属性 | 契约 |
| --- | --- |
| `items` | 受控数据；只显示 `count > 0` 的项目。改变数量、本人状态或删除项都必须由宿主更新数据。 |
| `onToggle(id)` | 切换意图，不直接改变 `items`。省略时保留原生按钮的聚焦与名单读取，但以 `aria-disabled` 声明没有切换操作。 |
| `recentItems` | `EmojiPickerItem[]`，只展示前八项。`selected`、对应回应的 `self` 与 `disabledReason` 都会阻止重复或无效选择。 |
| `onAdd(id)` | 快捷条的添加意图。省略时没有添加入口，适用于只读或无添加权限的场景。 |
| `renderPicker({ close })` | 完整面板槽。放入真实 `EmojiPickerPanel`，不要再放一个自带独立 Popover 的入口。选择业务操作后调用 `close()`。省略时快捷条不显示「更多表情」。 |
| `maxSelected` | 本人同时回应的种类上限，默认无限制。统计包含折叠项。达到上限仍允许取消本人已选回应。 |
| `collapseAfter` | 默认无限制。超过后只展示前 N 项与 `+N`；展开后显示「收起」。不修改原数据。 |
| `onLimit()` | 达到上限时激活添加入口或未选回应的提示出口；SDK 不包含业务轻提示文案。 |
| `limitMessage` | 覆盖添加入口的上限 Tooltip 与读屏说明；省略时按 `maxSelected` 生成通用说明。宿主可与 `onLimit` 的轻提示复用同一文案。 |
| `disabled` | 默认 `false`。不转发切换、添加和上限回调，关闭已打开的添加面板。 |
| 原生 div 属性与 `ref` | 属于根 `div[data-slot="reaction-bar"]`；默认不占 Tab 顺序，必要时可作为最后一个回应移除后的焦点落点。 |

达到上限不是原生 `disabled`：添加按钮仍可聚焦，带 `aria-disabled` 和原因说明，激活仅调用 `onLimit`。普通提交禁用同样保留焦点，不丢失正在交互的位置。完整选择器的 `onSelect` 是宿主的业务回调，因此宿主也必须在提交边界验证权限、上限和重复项；SDK 不拦截或改写槽内回调。

## 与真实选择器组合

以下适配器把宿主持有的目录与业务回调交给两个展示组件，不查询数据，也不维护第二份回应数据。目录里的 `selected` 应由宿主根据最新回应投影。

```tsx
import { useState } from "react";
import {
	EmojiPickerPanel,
	ReactionBar,
	type EmojiPickerGroup,
	type EmojiPickerItem,
	type ReactionItem,
} from "@violet/ui";

interface ArticleReactionsProps {
	items: readonly ReactionItem[];
	recent: readonly EmojiPickerItem[];
	groups: readonly EmojiPickerGroup[];
	onToggle: (id: string) => void;
	onAdd: (id: string) => void;
	pending: boolean;
}

function ArticleReactions({
	items,
	recent,
	groups,
	onToggle,
	onAdd,
	pending,
}: ArticleReactionsProps) {
	const [group, setGroup] = useState(groups[0]?.id ?? "");
	return (
		<ReactionBar
			items={items}
			recentItems={recent}
			onToggle={onToggle}
			onAdd={onAdd}
			disabled={pending}
			renderPicker={({ close }) => (
				<EmojiPickerPanel
					groups={groups}
					activeGroup={group}
					onGroupChange={setGroup}
					onSelect={(item) => {
						onAdd(item.id);
						close();
					}}
				/>
			)}
		/>
	);
}
```

评论可以不传两个限额属性并自然换行。聊天可传 `maxSelected={3}`、`collapseAfter={6}`，通过 `limitMessage` 与 `onLimit` 共用场景文案。气泡右侧对齐使用根容器的 `style={{ justifyContent: "flex-end" }}`，不添加业务变体。

## 名单与读屏

- 回应按钮的名称包含表情名、实际人数和「你已回应」状态；`aria-pressed` 反映 `self`。超过 99 的视觉数字为 `99+`，名称仍使用真实人数。
- 名单立即出现。相邻回应共享同一个 TooltipProvider，气泡沿用 Tooltip 的 180ms 位置接力，不重新淡入伪装切换。
- 本人已回应时先显示「你」，过滤 `recentUsers` 里 `self` 为真的条目，再显示至多两位其他公开名字。余数为真实总人数减去已展示人数。例如 8 人、本人和小雨/阿明显示为「你、小雨、阿明和另外 5 人」。
- 没有可公开名字且本人未回应时只显示「N 人」，不补造最近回应者。空白名字不占展示人数。
- Tooltip Portal 挂在回应根内，继承宿主的明暗、季节与 `data-motion`，而不是逃到缺少这些上下文的 body 下。

## 键盘、焦点和面板生命周期

- 回应是原生按钮，Tab 聚焦，Enter/Space 激活；只读项可聚焦读取名单，但没有切换操作。
- 添加按钮保留 `aria-expanded` 与稳定的 `aria-controls`。展开后触发器退出 Tab 序列，焦点进入快捷条首项。
- 常用条只有一个 Tab 停靠位；左右键循环，Home/End 到两端，Enter/Space 使用原生按钮行为。已回应项显示对勾，不重复选择。
- 「更多表情」以不同 `key` 的 MorphingPopoverContent 接替快捷条，仍是同一个 MorphingPopover 根和最初的添加按钮，外形从旧条真实接力到完整面板。完整选择器保留自己的网格、标签与键盘契约。
- 快捷条与完整选择器均通过 Portal 挂到触发器文档的 body，固定定位跟随原添加按钮，不参与消息滚动祖先的 scrollable overflow；换块和退场仍走相同几何动画。面板继承页面根主题，源作用域的 `data-motion="reduce"` 在开合期间继续生效。
- 完整面板选择后直接缩回 28px 原按钮，关闭期间保留完整内容，不先切回快捷条。关闭途中重新打开保留正在收回的块；完整关闭后再次打开从快捷条开始。
- Esc、点外面和焦点离开关闭；点到外部可聚焦控件时不抢焦点。正常关闭回到添加按钮，不再弹出普通「添加回应」提示。
- 当前聚焦回应移除时优先落到相邻仍可见回应，没有时落到折叠/添加入口，再没有则落根容器。用户已经离开到页面空白后不因后续数据更新抢回焦点。折叠入口因数据减少消失也有焦点回退。
- 退场项立即退出交互与读屏，再完成视觉收窄。同 ID 快速重新出现会取消旧退场任务并采用最新数据，不生成重复回应或被旧回调误删。

## 尺寸、样式与动效

唯一视觉实现为 `reaction.css`，BEM 根为 `.v-reaction`，只消费语义 token。回应高 28px、横向内边距 10px、内部间距 4px、组间距 6px、最长 120px；通常内容 15px，数字使用宿主 `--font-mono`、12px。本人状态使用 `selected` 系列语义色。添加入口为 28px 凹陷底圆钮，主图标 15px、角加号 8px。快捷条高 40px，格子 32px；窄屏允许格子在视口约束内轻微收缩。

| 变化 | 时序 |
| --- | --- |
| 数量增减 | 按方向位移/翻入 180ms；显示结果同为 `99+` 时不重播。 |
| 新回应 | 从宽 0 展开到自然宽，同时淡入，200ms。 |
| 本人加入已有回应 | 高亮反馈 400ms；取消或加入失败回滚不播放加入闪色，最终状态始终来自最新 `self`。 |
| 数量归零或移除 | 160ms 收窄并淡出；移除间距一并收回。 |
| 添加与面板接力 | 复用 MorphingPopover 的真实外形展开与 220ms 收回。 |
| 系统或宿主 reduce | 回应过渡只保留 100ms 透明度，不翻数字、不伸缩；共用浮层和高亮遵循各自的减弱动态契约。 |

聚焦环向内绘制，回应条的裁切不会切掉四边；只读屏说明是带明确 inset 起点的绝对定位节点，不借静态位置撑高滚动容器。所有动画与定时器在反转、状态更新和卸载时清理。

## 验收范围

就近行为测试覆盖受控数据、实际人数与名单、只读、限额/折叠、禁用、快捷条键盘、真实 EmojiPickerPanel 接力、关闭反转、焦点回退与快速失败回滚的数据生命周期；嵌套滚动容器用例覆盖 Portal 脱离裁剪祖先、候选点击、Escape 与焦点回归。独立 consumer 的交互回应区包含嵌套滚动容器与变换祖先，浏览器验收需要记录打开、接力与关闭前后的消息区 scrollHeight/clientWidth 不变，并确认两侧边缘候选实际可点击。视觉方向、实际几何与减弱动态还需要在浏览器验收：320/390px、明暗与四季主题、完整焦点环、添加按钮→快捷条→完整选择器→原按钮、开合途中反转、数字在 `99+` 边界两侧变化，以及宿主和系统 reduce。安装包的根/叶子入口、样式依赖闭合与外部 tarball 消费由包的最终验证覆盖；本文不代替这些执行证据。
