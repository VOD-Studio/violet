# 取色

`HsvColorPicker` 是不含浮层的共用 HSV 面板，`ColorSwatch` 是文字颜色的「A」触发器、传统色与可展开面板。主题种子复用前者，不把四季种子塞进文字预设。

```tsx
import { ColorSwatch, HsvColorPicker } from "@violet/ui";

<HsvColorPicker value={seed} onChange={setSeed} originalValue={openingSeed} />

<ColorSwatch
  value={textColor}
  onChange={applyToSelection}
  onClear={restoreBodyColor}
  recentColors={recentColors}
  onColorCommit={rememberColor}
/>
```

## 面板与输入

- `value`、`onChange` 是合法颜色通道；回调返回完整六位小写 HEX。输入显示去掉 `#` 的大写字符，支持三位简写、六位、带 `#` 的粘贴以及周围空白。
- 输入草稿由面板持有。合法三位即实时更新颜色，但保留三位草稿，接着输入第四至第六位不会被受控回声替换。非法中间态不回调颜色，也不在输入途中显示错误；失焦或 Enter 后才设 `aria-invalid`。继续输入清除错误外观。
- `onValidityChange(valid)` 只在合法性真正变化时通知（初始为合法），宿主可以据此禁用「应用」，不必提前展示错误。拖动、合法输入、外部颜色替换草稿、表单 reset 导致恢复合法时都会通知，重复输入同样非法或重复渲染不会再次通知。`invalid` 是显式外观控制，优先于内部失焦错误。错误文案与 Field 消息接线归宿主。
- `hexInputProps` 传原生 input 的 `id`、`name`、`form`、`ref`、可访问名称、描述与原生事件。表单提交的是可见、不带 `#` 的 HEX 字符串；需要完整规范色值的业务提交使用 `onChange` 的值。`onBlur`、`onKeyDown` 的 `preventDefault()` 会取消内部完成动作。所属 form（含 `form` 属性指向的外部表单）发生未取消的 `reset` 时，草稿恢复为当前受控颜色对应的 HEX，清除内部错误并报告有效；不触发 `onChange`，也不把受控 `value` 回退到旧值，颜色重置归宿主。宿主 `onReset` 里 `preventDefault()` 则整体保持不变。
- 外部不同颜色更新立即替换面板坐标及未完成草稿；自身 `onChange` 的受控回声保留 HSV 浮点精度，不把黑色/灰色的可调色相重置成 0。外部更新替换了非法草稿时，也会在提交后通过 `onValidityChange(true)` 恢复宿主合法性。
- `originalValue` 是左半比较色；省略时保存挂载时颜色。外部更新不会移动这个基准，点击或键盘激活左半可恢复。右半是当前色。
- `onColorCommit` 在拖动 pointerup、键盘一次步进、合法 HEX 失焦/Enter、比较色恢复、吸管选择完成时触发。`onChange` 则在拖动每一帧实时触发。取消的拖动不记录完成。

## 键盘、指针与吸管

饱和度区与色相条各是一个真实可聚焦 `role="slider"`。SV 的 `aria-valuenow` 是饱和度，`aria-valuetext` 同时说明饱和度和明度，色相读出角度。

| 控件 | 行为 |
| --- | --- |
| SV | ←/→ 调饱和度、↓/↑ 调明度，每次 1%，Shift 每次 10%，边界钳制 |
| 色相 | ←/↓ 减少、→/↑ 增加，每次 1°，Shift 每次 10°，首尾循环；Home/End 到条两端 |
| HEX | 保留原生编辑、选择和粘贴；Enter 完成当前草稿 |
| 原色 | 原生按钮，Enter/Space 恢复 |

Tab 依次进入 SV、色相、HEX、支持时的吸管，最后是恢复原色按钮；比较块视觉仍在 HEX 左侧。指针使用元素 pointer capture，只追踪活动 pointer id，取消或丢失捕获即停止；拖动不添加几何过渡。

浏览器存在 `window.EyeDropper` 时才渲染吸管，直接调用 `new EyeDropper().open({ signal })`。取消不改变颜色，卸载取消未完成请求；其他错误通过可选的 `onEyeDropperError` 交给宿主。选择进行中面板变为 `disabled`/`readOnly` 时请求立即 abort 并清除等待态；结果落地时再按请求身份、abort 与最新锁定状态判断，迟到的旧结果（成功或失败）既不提交颜色也不报错，旧请求收尾不会解除后来新请求的等待，卸载后不再通知。不可用时不展示伪吸管或原生取色替身。

`disabled` 禁用输入、按钮与 slider 停靠；`readOnly` 保留阅读与 slider 聚焦，但不接受颜色变化。根 `div` 的原生属性、className 与 ref 属于面板根。

## 文字颜色

`TEXT_COLOR_PRESETS` 是设计稿十二个 `{name,value}` 传统色：朱砂、赭石、琥珀、苔绿、竹青、石青、靛蓝、藏青、紫棠、胭脂、檀褐、墨灰。颜色是用户可选的数据，不是组件品牌 token；色块读颜色名，最近色无法匹配传统色时读完整 HEX。色块 24px、列间距至少 6px，hover 细环、选中纸色间隔与墨色双环，不缩放或位移。

- `recentColors` 由宿主管理，组件规范化、去重并显示最多六个。使用 `onColorCommit` 更新最近记录，避免拖动过程产生大量历史色。
- 「自定义」默认收起，以 280ms 的 grid 行展开；收起区域带 `inert` 与 `aria-hidden`。减弱动态下立即切换。`defaultCustomOpen` 用于需要直接展开的消费场景。
- 浮层复用非模态 Popover，不使用会抢走文本输入焦点的 menu。`open/defaultOpen/onOpenChange` 管理展开，`container/collisionBoundary` 接入宿主的挂载容器与碰撞边界。Popover 沿用 `.v-float` 的 200ms / 140ms 出入场及焦点恢复。
- `triggerProps` 原样传触发按钮，可保存编辑器选区；取消其点击或指针事件时尊重 Radix 的事件取消约定。

编辑器实时更新应保存原始选区并应用文字色事务，不在每次颜色回调调用 `.focus()`，否则会从 HEX 输入夺走焦点。关闭后恢复编辑器焦点的策略归编辑器宿主。最近颜色存储与清除动作后的业务提示也归宿主。

自定义主题的四季种子、生成算法、实际归一化调整说明与预览留在主题 feature；把种子作为 `HsvColorPicker.value`，合法颜色写回种子即可。

## 精度与样式入口

`hexToHsv` 不提前舍入 HSV；接受三位/六位 HEX，非法输入返回原有有效蓝色坐标 `{h:220,s:0.8,v:0.9}`。`hsvToHex` 只在最终 sRGB 字节舍入，色相按 360° 循环，S/V 钳制到 0–1，非有限值转为 0；输出仍为六位小写 HEX。`normalizeHexColor` 单独返回规范 HEX 或 `null`，用于输入边界校验，不用转换函数的蓝色回落做校验。

唯一视觉实现是 `color-picker.css`，闭合导入 input 与 popover CSS。面板 248px，SV 高 156px、圆角 12px，色相条高 12px、滑钮 18px，SV 指针 14px。渐变与 HSV 数据是取色器本身的色域，不是硬编码品牌色。组件框架、焦点、警告、纸面环和墨环消费语义 token。

行为测试覆盖 HEX 草稿、受控回声与外部更新、键盘步进、指针完成/取消、原生 input 接线、禁用只读、EyeDropper、最近色命名与展开焦点、转换边界和传统色纸面对比度。实际消费页需覆盖面板、文字预设、自定义展开、纸面对比度提醒、错误、只读与禁用；包内行为测试、真实 tarball consumer 与浏览器验收分别执行，不以文档代替验收证据。
