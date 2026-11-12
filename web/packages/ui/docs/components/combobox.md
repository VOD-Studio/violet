# Combobox

能打字的输入框加一列建议：可以从建议里选，开启 `creatable` 也可以就用自己打的字。适合选项很多、要边输入边筛的场景（标签、框架、跳转页面）。选项不多、只能从中选，用 select；要输入多个值，用 tag-input；全站搜索与命令，用 command。

```tsx
import { Combobox } from "@violet/ui";

<Combobox
  aria-label="标签"
  placeholder="输入或选择标签"
  options={tags.map((tag) => ({ value: tag, label: tag }))}
  value={tag}
  onValueChange={setTag}
  creatable
  onCreate={(text) => addTag(text)}
/>
```

## 接口

props 式单部件，没有子部件。原生 `<input>` 属性（`placeholder`、`autoComplete`、`onFocus`、`onKeyDown`……）透传给输入框；`className`、`style` 属于外壳（写 `w-80` 就是外壳宽度）；`name`、`form` 属于隐藏输入；`ref` 指向输入框。

| 属性 | 说明 |
| --- | --- |
| `options` | 建议：`{ value, label, description?, icon?, meta?, disabled?, group? }[]`；`value` 必须唯一。有 `onSearch` 时是服务端返回的当前结果 |
| `value` / `defaultValue` / `onValueChange` | 已选建议的 `value`，空串表示没有选择 |
| `inputValue` / `defaultInputValue` / `onInputChange(text, reason)` | 输入框里的文字；`reason` 是 `input`（键入）、`select`（选中、创建、外部值变化）、`clear`（清除钮或第二次 Esc）、`revert`（失焦还原、表单复位） |
| `filter` | `true` 大小写不敏感的包含匹配；函数自定义 `(option, query) => boolean`；`false` 全部列出。缺省：有 `onSearch` 为 `false`，否则 `true` |
| `maxSuggestions` | 最多列几条建议，默认 8；创建项不计入 |
| `highlight` | 给建议里第一处命中的文字加底色（`<mark>`），默认开 |
| `creatable` / `onCreate(text)` | 没有完全相同（不分大小写）的建议时，末行出现「创建「xxx」」；`onCreate` 之后 `onValueChange` 收到同一个文字 |
| `onSearch(query, { signal })` / `loading` | 停手 300ms 后调用；`signal` 在下一轮查询、失焦、选中、清除、卸载时中止；结果通过 `options` 回写，请求期间传 `loading` |
| `emptyText` | 没有建议时的内容，可以是节点或 `(query) => 节点`。缺省有 `onSearch` 写「没有找到「xxx」」，否则「没有匹配的项」 |
| `clearable` / `leading` | 清除钮（默认开）；输入框前的 16px 图标 |
| `variant` / `controlSize` / `invalid` / `valid` / `loading` / `disabled` / `readOnly` / `required` | 与 select、input 同名同义 |
| `name` / `form` | 隐藏输入，提交已选值 |
| `open` / `defaultOpen` / `onOpenChange` | 面板开合 |
| `container` / `collisionBoundary` / `panelClassName` | 面板挂载容器、判断「放不下」的边界、面板的 className |

选项行：最小高 36（有 `description` 为 48）、`icon` 是 32px 图标块、`meta` 在行内右侧 12px 次级文字、已选项墨色加粗并带右侧对勾。连续的同名 `group` 归入一个 `role="group"`，组名 12px 次级文字，不画分割线。

## 值与输入框文字

两组状态各管各的：`value` 是已选建议，`inputValue` 是输入框里看到的字。选中一条，输入框换成它的 `label`；开启 `creatable` 后采用键入的文字，`value` 就是这个文字本身。

- **查询**：键入过之后输入框里的文字就是查询；没键入时它只是已选值的标签，列表照样列全（已选项高亮），不会因为输入框里写着「Rust」就只剩一条。
- **值先到、标签后到**：`value` 对应的选项当前不在 `options` 里（异步结果换了一批、刚创建的文字）时，用最近一次见到的标签，从没见过就显示 `value` 本身；选项晚到、标签有了，没在键入的输入框会自动换成标签。
- **外部改了 `value`**：没在键入时输入框跟着换成新值的标签；键入中不打断。
- **键入删光文字**等于清除已选值（`onValueChange("")`）。
- **失焦一致性**：焦点移出组件时，输入框里没选中的草稿还原为已选值的标签，没有已选值就清空（`creatable` 也一样，没按 Enter 或点创建项的文字不保留）。设计稿的演示脚本没有写这一步，按规格的「未选中则还原为已选标签或清空」实现。

## 展开与匹配

- **聚焦即展开**（设计稿 `_focus` 直接打开）；点输入框、键入、关闭状态下按 ↓ ↑ 也展开。没有任何内容可列（没有选项、没有查询、不在加载）时不展开，`aria-expanded` 保持 `false`。
- 有查询但没有建议时面板写 `emptyText`；`loading` 且没有建议时写「加载中…」（无查询）或「正在查找…」（有查询），并带指示器。
- 打字时默认高亮第一条匹配（`aria-selected` 落在它上面，键盘模式下画自身底色）；没打字时高亮已选项，没有已选项就没有高亮，Enter 不会替用户选第一条。
- 拼音首字母匹配不做：设计稿与规格只写了「大小写不敏感、任意位置」，站点里拼音声母只用在 select 的前缀预测输入（typeahead）上。需要时用 `filter` 函数自定义。

## 异步

```tsx
<Combobox
  aria-label="搜索文章"
  options={results}
  loading={pending}
  onSearch={(query, { signal }) =>
    fetchPosts(query, { signal }).then(setResults, () => {})
  }
/>
```

停手 300ms 后调用 `onSearch(文字, { signal })`；键入后到请求返回之前（防抖加请求），右侧是 16px 指示器、输入框 `aria-busy`，列表**保留上一次的结果，不闪空**。防抖期间由组合框自己算忙，请求期间的忙靠 `loading`，调用方请求开始到结束都要传。`signal` 在下一轮查询开始、失焦、选中、清除与卸载时中止上一轮：`fetch(…, { signal })` 直接用，自己的异步写 `if (signal.aborted) return` 再回写，先 `a` 后 `ab`、`a` 的结果晚到时就不会覆盖 `ab` 的。失焦、卸载同样取消还没触发的查询；清除钮会立即以空串调用一次 `onSearch`，方便调用方清掉旧结果。设计稿演示脚本里的 600ms 是防抖加模拟延迟合在一起，实现取规格表的 300ms 防抖。读屏：展开且在查找（防抖等待或 `loading`）时优先播报「正在查找」，即使没有查询文字、列表还保留着旧建议。

## 键盘与读屏

焦点始终在输入框，高亮项由 `aria-activedescendant` 指出；输入框 `role="combobox"`、`aria-autocomplete="list"`、`aria-expanded`、展开时 `aria-controls` 指向 `role="listbox"` 的面板，选项 `role="option"`。组合框里 `aria-selected` 表示**当前高亮项**（ARIA 组合框惯例），已选项另用墨色加粗与对勾表达。

| 操作 | 结果 |
| --- | --- |
| 键入 | 展开并过滤，高亮回到第一条匹配 |
| ↓ ↑ | 展开时移动高亮，跳过禁用项，**不循环**；关闭时展开，没有高亮就落在第一条（↑ 落在最后一条） |
| PageUp / PageDown | 一次移动 8 条 |
| Home / End | 留给输入框移动光标，不动高亮 |
| Enter | 选中高亮项；没有高亮且 `creatable` 时采用键入的文字（与某条建议完全相同就选它）；其它情况不拦截，表单照常提交 |
| Esc | **先收起，保留文字；再按一次清空文字并清除已选值**。在对话框里第一次 Esc 只收起面板，不关对话框 |
| Tab、焦点移出、点外部 | 收起；Tab 放行去下一个控件，不还焦点；失焦时还原草稿 |

输入法选词期间（`isComposing` 或 `keyCode 229`）方向键与 Enter 不处理，属于输入法。设计稿没有 PageUp / PageDown，这里沿用 select 地基的 8 项一页。

输入框旁有一个只给读屏的 `role="status"` 播报节点：展开时读出「N 条建议」（N 不含创建项），加载或防抖等待时读出「正在查找」，没有建议时读出 `emptyText`（不是字符串时读「没有匹配的项」）。

选项的按下与面板上的所有按下都会 `preventDefault`，点建议、点滚动条不会让输入框失焦。

## 外壳、表单与 Field

外壳是 `input` 单元的 `v-input-control`：四变体、三档尺寸（32 / 36 / 40，触屏各加 4、字号 16）、出错 / 通过 / 加载 / 只读 / 禁用的画法与输入框一致；`loading`（或查询忙）时右侧是 16px 指示器，出错与通过只换聚焦色，不画状态图标（与 select 一致）。清除钮与 input 单元一致：24px 圆钮、`aria-label="清除"`、常驻 DOM 以便 Tab 到达，视觉上只在悬停或焦点在控件内时出现，有文字、可编辑时才有；点击后焦点回到输入框。它自己失焦（Tab 离开）时与输入框一样收起面板并还原草稿。鼠标按下不让输入框失焦。`readOnly` 可聚焦可复制，不展开、没有清除钮。

`Field` 的唯一子元素是 `Combobox` 时，它克隆过来的 `id`、`aria-describedby`、`aria-invalid` 直接落在输入框上，标签 `for` 命中它；显式的 `invalid` 优先于 `aria-invalid`。面板 `listbox` 的名称取 `aria-label`，否则取 `aria-labelledby`，再否则指向输入框（`Field` 里即表单项标签）。`required` 只写 `aria-required`。

给了 `name` 才渲染隐藏 `<input type="hidden">`，提交已选值（创建的文字就是它本身），没选时提交空串，`disabled` 时不提交；输入框里的草稿不进表单。表单 `reset` 时一律回到 `defaultValue`（没给则回到空）与它的标签，受控的值也会收到一次 `onValueChange`（值不同时），`onInputChange` 收到 `reason: "revert"`。监听的表单按 `form` 指向的 id 找，没给就取输入框所在的表单，所以外置表单的 reset 同样有效；事件被取消时不复位。

## 面板

面板是共用的 `lib/picker-panel.tsx`：Radix Popover 的 `Anchor + Portal + Content`，非模态、不抢焦点，与外壳同宽（最小 160）、距外壳 6px、放不下翻到上方；挂到 `document.body`，用 `container` 改挂到陈列室舞台或带缩放的宿主，`collisionBoundary` 传舞台就不会越出。进出场沿用共享的浮出动画：进入 200ms、收起 140ms，不缩放，减弱动态只做 100ms 透明度；收起动画播完才卸载，期间列表停在收起那一刻，不会因为选中后输入框换成标签而闪成全部建议。Esc 在 Radix 的捕获阶段处理，组合框自己对 Esc 的判断**不看 `defaultPrevented`**（站点根上常驻的 Radix 层会先对每个 Esc 调用 `preventDefault`），只有调用方 `onKeyDown` 里主动 `preventDefault` 才取消组合框的按键处理；并且以「按键开始时面板是否展开」为准，浏览器会在 Radix 收起面板之后、组合框的回调之前提交这次更新，否则同一次 Esc 会把「收起」误判成「清空」。

## 没有做的

- 设计稿形态 a 的「累积多选，最多 6 个」属于 tag-input，不在这里；`value` 只有一个。
- 设计稿「最近」分组右侧的「清除」文字钮不做：分组名是纯文字标签；需要的话调用方在自己的数据里处理最近使用。
- 「最近」项前的 History 图标：用选项自己的 `icon`（32px 图标块），组合框不另做 16px 行内图标；只有创建项前的 16px 加号是组合框自带的。

## 导入

React 从 `@violet/ui` 或 `@violet/ui/combobox` 导入；按需 CSS 使用 `@violet/ui/components/combobox.css`，已含输入框外壳、指示器与面板的依赖样式。
