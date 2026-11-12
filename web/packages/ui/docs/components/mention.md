# MentionList 提及候选

输入框下方的人与角色候选面板：listbox 语义、指针与键盘共用一套高亮，可提及人数写在可访问名称里。它不会自己弹出、不解析 `@`、不插入文本——触发词、键盘与替换都交给持有输入框的宿主。

```tsx
import { filterMentionCandidates, MentionList, mentionOptionId, parseMentionTrigger } from "@violet/ui";

const trigger = parseMentionTrigger(editorText, caret);
const matches = trigger ? filterMentionCandidates(candidates, trigger.query) : [];

<MentionList
  id={listboxID}
  candidates={matches}
  activeIndex={activeIndex}
  onActiveIndexChange={setActiveIndex}
  onSelect={(candidate) => replaceTrigger(trigger, `@${candidate.displayName}`)}
  query={trigger?.query}
/>
```

## 候选字段

| 字段 | 契约 |
| --- | --- |
| `id: string` | 用户 ID，也是选项目录 id 的组成部分；「全体成员」用保留值 `all`。 |
| `username: string` | 写进提及占位符的 username 段，参与筛选。 |
| `displayName: string` | 提及节点与历史回显的可见文字，参与筛选与拼音首字母匹配。带 `memberCount` 的条目在候选列表里改称「全体成员」，占位符仍是 `@所有人`（与后端 humanize 一致）。 |
| `avatarUrl?: string` | 缺省或无图时显示首字。 |
| `role?: "owner" \| "member"` | 只有 `owner` 显示「管理员」标签，`member` 不显示标签。 |
| `isBot?: boolean` | 显示「机器人」标签。 |
| `memberCount?: number` | 给出人数即按「全体成员」条目渲染：全体图标加「N 人」，不画头像。宿主用这个字段表达「全体成员」，另可用 `id: "all"` 对应占位符的保留目标。 |

## 筛选与排序

`filterMentionCandidates(candidates, query, limit = 6)`：

- 显示名与用户名按字面忽略大小写包含匹配；显示名另按拼音首字母前缀匹配（`pinyinInitials`，只覆盖 GB2312 一级字，不做全拼与多音字）。
- 「全体成员」条目按列表名称「全体成员」与人数匹配（输入 `全体` 或 `23` 都能找到「全体成员 · 23 人」）。
- 排序：`memberCount` 条目恒置顶，其余保持传入顺序——「最近发言者排前」由宿主在传入顺序里表达，筛选只保留顺序。
- 默认最多 6 条，先筛后截，置顶条目不会因为截断被挤掉。

`parseMentionTrigger(text, caret?)` 解析触发态：`@` 必须在行首或空白之后，查询词不含空白与第二个 `@`，最长 20 个字；邮箱里的 `@` 不触发。返回 `{ start, end, query }`，`start` 到 `end` 就是插入时要替换的片段。

## 键盘与无障碍

- 输入框侧提供 `aria-autocomplete="list"`、`aria-expanded`、`aria-controls` 与 `aria-activedescendant`；`aria-activedescendant` 用 `mentionOptionId(listboxID, candidate.id)`，筛选重排后仍指向同一行。
- 键盘属于持有焦点的输入框，列表只显示：↑↓ 换高亮（宿主可循环），Enter 与 Tab 插入，Esc 收起但保留已输入的文字。
- 列表是 `role="listbox"`，每项 `role="option"` 带 `aria-selected`；指针与键盘共用同一套高亮，滚动高亮项后静止指针不会劫持它，真实移动才恢复悬停选中。
- 可提及对象数写进 listbox 的 `aria-label`，另由独立的 `aria-live="polite"` / `aria-atomic="true"` 状态区在挂载后宣布；筛选改变数量时更新，方向键换行不会重复宣布。全体成员是一项可选对象，其涵盖的成员人数显示在该行。
- 高亮项变化用 `scrollIntoView({ block: "nearest" })` 滚进可视区。
- 选项不进入 Tab 序列，焦点保持在编辑区；Tab 由宿主用于插入当前项。指针进入后即使不离开行，只要真实移动，也会重新选中该行。

## 视觉与边界

面板宽 300，浮在输入框下方 6px；行内是 24px 头像、显示名、等宽用户名与角色胶囊。浮起只用 `--shadow-soft`，圆角 12，只用透明度过渡，不做缩放与位移。减弱动态同时覆盖 `prefers-reduced-motion: reduce` 与 `[data-motion="reduce"]`：面板直接出现，选项不再过渡底色。

列表滚动区留 4px 内边距与等量负外边距，聚焦环不会被裁掉；零候选时显示「没有叫「查询词」的人」，宿主据此决定是否保持展开。

## 样式入口

从 `@violet/ui` 或 `@violet/ui/mention` 导入 `MentionList`、`filterMentionCandidates`、`parseMentionTrigger`、`mentionOptionId` 与相关类型。

```css
/* 普通 CSS 宿主 */
@import "@violet/ui/tokens.css";
@import "@violet/ui/components/mention.css";
```

Tailwind v4 宿主在 Tailwind 后导入 `@violet/ui/styles.css`。React 与纯 HTML 共用 `.v-mention` 以及 `__label`、`__list`、`__option`、`__all`、`__name`、`__handle`、`__tag`、`__empty` 类；头像样式随面板一起加载。

实际消费页验收评论与聊天房间两种语境，聊天房间比评论多「全体成员 · N 人」。

## 站点集成与消费验收

`shared/ui/rich-text-input` 持有真实 DOM 编辑、提及筛选、列表和键盘逻辑，不导入任何实体或 feature。编辑器只接收 `shared/lib/inline-emoji` 的 `token/src/text/size` 最小显示模型；评论与聊天通过 `entities/emoji/lib/inline-emoji` 投影表情分组与选择结果，注入选择器和上传回调。纯提及占位符协议位于 `shared/lib/mention-token`。批注的可交互上下文只留在评论业务适配器。聊天创建、编辑和预览均直接消费共享能力，不经过评论 feature。本单不为评论、推文评论或批注新增提及入口。

底部固定的聊天输入把候选放进输入区下方的文档流；面板出现时输入区向上增高、消息列表缩短，候选不越过视口，也不翻到输入框上方。其他正文输入保留相距 6px 的浮层定位。

本单元 `fixtures/consumer.tsx.template` 是独立消费片段，使用公开叶子 JS 入口；父级消费者需将其复制为 `mention.tsx`，在入口渲染 `MentionConsumer`，并加载 `tokens.css` 与 `components/mention.css`（或现有完整 `styles.css`）。SSR 入口渲染同一片段，类型入口导入公开 `MentionCandidate`；浏览器覆盖上下键、Tab/Enter、Esc 保留输入和读屏状态。片段不依赖工作区别名。

展品固定占地为 360 × 330，包含输入标签、输入框、6px 间隙与六行候选；评论与房间两语境共用同一输入交互，光标位于正文中间时只替换触发片段，保留前后正文。