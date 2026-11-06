# TagInput：标签输入

在一个输入框里输入多个值，每个值变成一个小标签。外壳就是输入框外壳，内容多了自动换行变高。值是 `string[]`：文章标签、笔记标签、邮件收件人。只能从固定几项里挑选，用 select 的多选；要边输入边筛一个值，用 combobox。

```tsx
import { Field, TagInput } from "@violet/ui";

<Field label="文章标签" hint="回车、逗号或顿号生成标签" count={{ value: tags.length, max: 10 }}>
  <TagInput value={tags} onValueChange={setTags} max={10} suggestions={allTags} />
</Field>
```

## 属性

| 属性 | 作用 |
| --- | --- |
| `value` / `defaultValue` / `onValueChange` | 标签列表 `string[]`，受控或非受控；每次增删各回调一次，粘贴多段文本也只回调一次 |
| `max` | 数量上限，到达后输入框停用 |
| `suggestions` | 候选标签 `string[]`；给了才有建议浮层，输入框也随之成为 `role="combobox"` |
| `validate` | `(tag) => string \| null`，返回说明表示不合格 |
| `normalize` | `(raw) => string`，加入前整理文本（如 `raw.replace(/^#/, "")`），整理成空串的被丢弃 |
| `onReject` | 添加被拒绝时回调 `{ reason: "duplicate" \| "max" \| "invalid", tag, message }` |
| `placeholder` | 没有任何标签时的占位，默认「输入后按回车」 |
| `name`、`form` | 每个标签一个隐藏 `<input>` 参与 `FormData`，没有标签不提交 |
| `variant`、`controlSize`、`invalid`、`valid`、`loading`、`disabled`、`readOnly`、`required` | 与 Input 一致 |
| `container`、`collisionBoundary` | 建议浮层的挂载容器与碰撞边界，陈列室舞台与带缩放的宿主需要传入 |
| `id`、`aria-label`、`aria-labelledby`、`aria-describedby`、`aria-invalid`、`ref`、`onFocus`、`onBlur` | 都落在真正的 `<input>` 上 |
| `className`、`style` | 落在外壳 `div` 上 |

## 生成、去重与删除

- **生成**：Enter、半角逗号 `,`、全角逗号 `，`、顿号 `、`、换行。空格不拆，标签里可以有空格。输入框里打出分隔符，前面的段立即成为标签，最后一段留在输入框；Enter 与失焦提交整段输入。
- **粘贴**：剪贴板文本含分隔符时整段拆开、一次加入（浏览器会把粘贴的换行抹成空格，所以组件自己读剪贴板）；光标之后的文字留在输入框。不含分隔符走浏览器默认行为。
- **顺序**：每段依次做：去空白 → `normalize` → 判上限 → 去重 → `validate`。空段略过；上限一满，这一批后面的段不再处理；批量里只汇报第一个拒绝。
- **去重**：不分大小写（`Go` 与 `go` 是同一个），重复项不加、输入清空，已有的那个标签闪 600ms（季节色 40% 底，只变底色）。减弱动态（系统偏好与 `[data-motion="reduce"]` 作用域）不闪，但照样播报与回调。
- **校验**：`validate` 不合格时输入原样保留，输入框与外壳进入出错态（`aria-invalid`、`data-invalid`），一继续输入就清除。失焦提交遇到不合格同样保留文本，不丢字。
- **删除**：点芯片的 `×`；输入框为空时退格**两段式**：第一次选中最后一个标签（底色加深），再按一次删除。左右方向键在标签间移动选中（光标在输入框最前时 `←` 进入标签，`→` 越过最后一个回到输入框），选中后 Backspace 或 Delete 删除。输入、失焦都会取消选中。
- **失焦**：输入中的文本自动成为标签（「打一半点走也会成标签」）；不合格的保留在输入框。
- 组合输入（IME）期间，`isComposing` 为真或 `keyCode` 为 229（Safari 在 `compositionend` 之后才发 Enter 的 keydown）的按键一律不处理；组合期间输入里的全角逗号也不拆，`compositionend` 之后才拆。
- Enter 总是 `preventDefault`，在表单里不会因它提交。

## 上限

到达 `max` 后：输入框 `aria-disabled="true"` 且 `readOnly`（不用原生 `disabled`，焦点与读屏仍可达），占位清空，原因「最多 N 个，删掉一个才能再加」进输入框的 `aria-describedby`（读屏用的隐藏文本）。此后按 Enter 或字符键、粘贴都会被拦下并播报原因、回调 `onReject({ reason: "max" })`。退格与 `×` 照常删除，删掉一个即恢复。

## 读屏与结构

外壳里的标签是 `role="list"`（`aria-label="已添加的标签"`）里的 `role="listitem"`，`×` 是独立按钮（`tabindex="-1"`、`aria-label="移除 {标签}"`，用退格代替 Tab 到它）。承载 `role="list"` 的节点自己是换行的 flex 容器（保留布局盒，不用 `display: contents`，否则部分浏览器会把列表语义抹掉），输入框包在它里面一个 `role="none"` 的节点中，与芯片同排换行；`role="none"` 对无障碍树透明，输入框不是 listitem。没有标签时该节点不带 `role`，不暴露空列表。

外壳内有一个 `role="status"` 的礼貌播报区：

| 时机 | 播报 |
| --- | --- |
| 生成 | 「已添加 Go」（一批多个：「已添加 a、b、c」） |
| 删除 | 「已移除 Go，还有 2 个」 |
| 方向键或退格选中 | 「已选中 Go，再按退格删除」 |
| 被拒绝 | 拒绝说明本身：「已经有「Go」了」、「最多 3 个，删掉一个才能再加」、`validate` 返回的说明；与「已添加」同批时用「。」相连 |

相同的话再说一遍时播报节点会重建，读屏才会重读。

## 建议

给了 `suggestions` 才有。**输入非空才弹**，聚焦空输入不弹；匹配是「包含」（不分大小写，匹配片段 `<mark>` 高亮）；已选项不再推荐；没有同名候选（也没有同名已选项）时末尾追加「创建「xxx」」。`normalize` 先作用于查询串。满了、禁用、只读时不弹。

输入框是 `role="combobox"`，带 `aria-haspopup`、`aria-expanded`、`aria-controls`、`aria-autocomplete="list"`，高亮项由 `aria-activedescendant` 指出；面板与选项行就是 select、combobox 共用的 `lib/picker-panel.tsx`（外观与键盘一致）。焦点始终在输入框。

| 操作 | 结果 |
| --- | --- |
| ↓ ↑ PageDown PageUp | 移动高亮，不循环；一开始**没有**高亮 |
| Enter | 有高亮：选中高亮项（「创建」项提交输入框原文）；没有高亮：提交输入框原文 |
| Esc | 收起面板，文本保留；继续输入或再按 ↓ 重新展开。在对话框里第一次 Esc 只收起面板，不关对话框 |
| Tab、失焦、点外部 | 收起；输入中的文本成为标签 |
| Home、End、← → | 留给输入框自己移动光标，不进引擎 |

Esc 在 Radix 的捕获阶段判定，不看 `defaultPrevented`（站点根上常驻的 Radix 层会先对每个 Esc `preventDefault`）。

## 表单与 Field

`Field` 的唯一子元素是 `TagInput` 时，它克隆来的 `id`、`aria-describedby`、`aria-invalid` 落到真正的 `<input>`：标签 `for` 命中输入框，`aria-describedby` 与组件自己的原因说明（上限、校验错误）取并集，显式给的同名属性优先。

字数计数、重复/校验的可见提示都是 `Field` 的职责：设计稿里右下角的「3 / 8」与说明行就是 Field 的消息行，所以 TagInput 不自己画。字数用 `count={{ value: tags.length, max }}`；把 `onReject` 的 `message` 接到 `error`（按需自己计时清除，值变化时清除）即可显示「已经有「Go」了」或 `validate` 的说明。没有 Field 时，错误只通过出错外观与读屏播报呈现。

`name` 给了才渲染隐藏输入：每个标签一个，`disabled` 时不提交，输入中尚未成为标签的文本不提交。表单 `reset` 时回到 `defaultValue`（没给则回到空，受控也一样）并清掉输入中的文本，`onValueChange` 会收到一次；所属表单按 `form` 指向的 id 查找，没给则取输入框所在的 `<form>`。

## 外壳与尺寸

外壳复用 `input` 单元的 `v-input-control`（四变体、三档尺寸、聚焦环、出错/通过/禁用/只读），改成 `min-height` 加 `flex-wrap`：单行时高度就是尺寸档（32/36/40，触屏各加 4）。芯片高 24（触屏 28）、圆角 6、底色墨色 8%、字号 13；`×` 18×18（触屏 22×22）、圆角 5；待删芯片底色墨色 16%。输入区最窄 80px，放不下自己换行。`loading` 的指示固定在首行右端，不参与换行。禁用与只读不画 `×`。

## 设计稿取舍

- **间距**：设计稿规格表写「标签与输入区之间 4」，而输入框外壳的 `gap` 是 8。以规格表为准，外壳 `gap` 取 4px（横竖都是）。设计稿本身没有 `.in-multi` 的换行 CSS，换行形态按上面实现。
- **按规格表而非演示脚本**：外壳 `role="list"` 与芯片 `listitem`、左右方向键移动选中、「已添加 / 已移除」播报、上限用 `aria-disabled`、IME 守卫，演示脚本里都没有，按规格表补齐。上限不用演示里的原生 `disabled`，因为它会丢焦点与读屏可达性；输入框同时 `readOnly`，是为了在 IME 与拖放等路径上也真正不可输入。
- **建议浮层**：演示里是不 portal 的绝对定位；这里用共用的面板外壳（portal、碰撞翻转、`container`）。演示没有 `aria-activedescendant`、`aria-expanded` 等，补全为 combobox 语义。
- **计数**：见上，交给 Field。
- 建议只有文字，没有设计稿里的「n 篇」用量计数；候选项目前只是 `string[]`。
- 「创建」项没有设计稿里的加号图标：共用选项行没有 16px 图标槽。

## 与相邻单元

| 单元 | 分工 |
| --- | --- |
| `select`（`multiple`） | 从固定几项里挑；值是候选之一，不能自由输入 |
| `combobox` | 边输入边筛一个值或多个值，面板是主角；TagInput 是「芯片在输入框里」的形态，建议只是辅助 |
| `input` | 单个文本；TagInput 的外壳样式与它同源 |

## 导入

React 从 `@violet/ui` 或 `@violet/ui/tag-input` 导入；按需 CSS 使用 `@violet/ui/components/tag-input.css`，已含输入框外壳、指示器与面板的依赖样式。
