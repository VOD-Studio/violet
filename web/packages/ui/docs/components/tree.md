# Tree

常驻在页面上浏览与选择有层级内容的树：文档目录（系列与章节）、素材文件。选中的语义是「当前项」（导航与浏览），不做勾选。表单里从树中选一个或几个值用 TreeSelect；只有一层分组用折叠面板；没有层级用列表。TreeSelect 的树行与 Tree 同源但**不共享实现**：缩进每级 18（Tree 是 20）、右侧内边距 4（Tree 是 8）、焦点在触发器（Tree 的焦点在树容器上）。

```tsx
import { Tree } from "@violet/ui";

<Tree
  aria-label="系列目录"
  nodes={[
    {
      value: "blog",
      label: "从零写一个博客",
      meta: "12 篇",
      children: [{ value: "ch1", label: "第 1 章 · 脚手架", meta: "2,104 字" }],
    },
    { value: "rust", label: "Rust 全栈笔记", lazy: true },
  ]}
  loadChildren={(node) => fetchChapters(node.value)}
  value={slug}
  onValueChange={setSlug}
/>
```

## API

单一数据驱动组件，`nodes` 是树；不是组合式部件。

| 属性 | 作用 |
| --- | --- |
| `nodes` | 节点 `{ value, label, children?, lazy?, disabled?, icon?, meta? }`；`value` 在整棵树里必须唯一 |
| `value` / `defaultValue` / `onValueChange` | 当前项的 `value`（`string`，空串表示没有当前项）；点行或 Enter / Space 选中，已是当前项不再触发 |
| `expanded` / `defaultExpanded` / `onExpandedChange` | 展开着的节点 `value` 数组 |
| `loadChildren` | 懒加载，见下 |
| `icons` | 给没有自带 `icon` 的节点补默认图标，见下；缺省 `false` |
| `id` / `aria-label` / `aria-labelledby` / `aria-describedby` / `className` / `style` / `ref` 与其它原生属性 | 落在 `role="tree"` 的容器 `div` 上；`onKeyDown` 先于组件执行，调用 `preventDefault` 后组件不再处理 |

`role`、`tabIndex`、`aria-activedescendant` 由组件持有，不接受外部传入。树的名称取 `aria-label` 或 `aria-labelledby`，必须给一个。

节点字段：

- `label` 是行的文字，也是读屏的名称与 typeahead 的匹配对象。
- `meta` 行右侧靠右的 12px 等宽次级信息（篇数、字数），由调用方给，不自动计算；读屏里作为行的描述，不混进名称。
- `icon` 16px 次级色图标；传 `null` 表示这一行不要图标。缺省行为见 `icons`：开启后目录是文件夹（展开时换打开的文件夹）、叶子是文件。文档目录不开 `icons`，文件树开。
- `disabled` 禁用的节点不能选中、不能展开，键盘跳过它（见下）。
- `lazy` 见下。

## 值、展开与选中

- 选中与展开是两件事：**点箭头只展开收起，点行只选中**，目录与叶子都能被选为当前项。键盘移动与展开都不改变当前项。
- 受控与非受控各自独立：`value` 与 `expanded` 可以一个受控一个不受控。受控时不回写 `onValueChange` / `onExpandedChange` 的值，界面不变。
- `value` 找不到节点（空串、不存在、在尚未取回的子树里）时没有任何行 `aria-selected="true"`。
- 展开集合里可以放尚未出现的节点 `value`，它在祖先展开、自己成为目录之前不生效。

## 懒加载

节点写 `lazy: true` 且传了 `loadChildren(node) => Promise<TreeNodeData[]>`。

- 第一次展开（点箭头、→）时调用；箭头换成包内 `indicator` 单元的梅花指示器（`FlowerBloom kind="plum"`，16px，沿用文字色），行带 `aria-busy="true"`、`aria-expanded="true"`，取回成功后子节点直接出现；已取回的不再取，收起再展开不会重复请求，在途时重复展开不会重复请求。
- 失败（拒绝或同步抛错）：整行变危险色（`--destructive-text`）、右侧提示「加载失败，点击重试」（也是行的描述）、行收起；点这一行、点箭头、键盘 → 或 Enter 都重试，重试期间不选中该行。
- 取回为空数组的节点变成叶子：没有箭头、没有 `aria-expanded`，不再取。
- 没传 `loadChildren` 时 `lazy` 按叶子处理；节点自带非空 `children` 时 `lazy` 不再生效。
- 取回的子节点缓存属于传入的 `nodes`：`nodes` 换了引用，旧缓存清空、在途请求的结果作废，同一节点重新等待取回。**要保持缓存，`nodes` 的引用必须稳定**（模块常量、`useMemo`、查询缓存的数据）；`loadChildren` 取最近一次渲染传入的，可以是内联函数。取回的节点同样参与展开与选中，`value` 同样要在整棵树里唯一。
- 卸载后到达的结果被丢弃。

## 键盘与读屏

容器 `role="tree"`，行 `role="treeitem"`（行是平铺的，不嵌 `group`），带 `aria-level`（根是 1）、`aria-posinset`、`aria-setsize`、`aria-selected`（每一行都写 `true` / `false`）；目录带 `aria-expanded`，叶子不写；禁用行 `aria-disabled="true"`；取回中的行 `aria-busy="true"`。行的名称取自文字，不含箭头；`meta` 与失败提示是描述。

整棵树一个 Tab 位置：容器 `tabindex="0"`，行与箭头都不可聚焦；键盘所在的行由 `aria-activedescendant` 指出，行 id 由 `useId` 与节点 `value` 派生，服务端首帧与水合后一致。键盘所在的行默认是当前项（看不见或没有则是第一个可用行）；点击会把它移到被点的行；它被外部收起而看不见时回落到当前项、再回落到第一个可用行。键盘移动会把该行滚进最近的滚动容器的可见范围。

| 按键 | 结果 |
| --- | --- |
| ↓ ↑ | 在可见行间移动，跳过禁用行，**不循环** |
| Home / End | 到首个 / 末个可用行 |
| → | 收起的目录先展开（懒加载节点开始取回）；已展开再按进入第一个可用子项；叶子不动 |
| ← | 展开的目录先收起；已收起或叶子回到上级（最近的未禁用祖先）；根上不动 |
| Enter / Space | 选中键盘所在的行；取回失败的行是重试 |
| 输入字母 | typeahead，见下 |
| Tab 等其它按键 | 不处理，不 `preventDefault` |

带 Ctrl / Meta / Alt 的组合键、输入法组合中（`isComposing`）的按键不处理。

**typeahead**：输入一个可打印字符，跳到以它开头的下一个可见、未禁用的行，不分大小写，到末尾后回到开头；连续输入累积成前缀（「ru」跳到以 ru 开头的行，首先从当前行起找，当前行已匹配就不动）；反复按同一个字母（「aaa」）在同首字母的行间循环；**两次按键间隔超过 500ms 缓冲清空**，重新开始。缓冲有内容时空格属于前缀，不会选中当前行；缓冲为空时 Space 选中。只在可见行里找，收起的子项不参与；找不到匹配时不动。

鼠标：点箭头（20px 区域，只对目录）展开收起；点行选中；禁用行点击无效，也不移动键盘所在行。箭头是纯指针功能（`aria-hidden`、不可聚焦），键盘与读屏用户走 → ←。

禁用的节点（行 40% 透明、`not-allowed`）**整行惰性**：不能选中、不能展开收起（含箭头），键盘移动、Home / End、→ 进入子项都跳过它；← 回上级也跳过被禁用的祖先。禁用节点的子孙如果已经在展开集合里仍然可见、可用。

## 外观与动效

行高 32、圆角 8、每级缩进 20（`padding-inline-start = 4px + 层级 × 20px`）、行间 2、右内边距 8；容器内边距 4、圆角 12、最大宽度 420px。箭头区 20px、箭头 14px，展开时转 90°，140ms；叶子用同宽空位对齐。当前项是 `--muted` 凹陷底、墨色字、字重 600，**优先于悬停**（行自己的底色盖在滑动高亮之上）。悬停是共用的滑动高亮（`list-highlight`，280ms）。计数靠右、等宽 12、次级色。

子项展开直接出现与消失，**不做高度动画**（目录很长时整块向下推会晃）。容器键盘聚焦（`:focus-visible`）时画 2px `--ring` 环，键盘所在的行再画一圈行内 2px 环；鼠标点击聚焦不画。

减弱动态（系统偏好与 `[data-motion="reduce"]` 两个作用域）下箭头不转（直接跳到位，没有过渡）、悬停高亮直接跳到新位置。梅花指示器是活性反馈，按 indicator 单元的约定不受减弱动态抑制。

## 已知边界

- 不做多选勾选（属于 TreeSelect）、不做搜索过滤、不做拖拽排序、不做虚拟滚动；很长的树放在调用方的滚动容器里，键盘移动会跟随滚动。
- 展开集合不会因为 `nodes` 换了而被清理；不存在的 `value` 无害。
- 行是平铺的 `treeitem`，不嵌 `role="group"`；层级关系由 `aria-level` / `aria-posinset` / `aria-setsize` 表达。
- 设计稿演示脚本的差异，一律按规格表实现：脚本里懒加载是在目录下插入一行「正在加载…」，这里按规格改为箭头换指示器 + `aria-busy`；脚本的 typeahead 只向后找且不回绕，这里回绕并带缓冲；行补 `aria-posinset`、`aria-setsize`、稳定 id 与 `aria-activedescendant` 常驻；Home / End 保留；失败重试脚本没有，按规格实现。

## 导入

React 从 `@violet/ui` 或 `@violet/ui/tree` 导入；按需 CSS 使用 `@violet/ui/components/tree.css`，已含滑动高亮与梅花指示器的依赖样式。
