# NumberInput 数字输入

用于精确数量、价格、比例等有步长或范围的数值；邮编、验证码仍用 Input 或 InputOTP。实现依据 `docs/design/ued/project/InputNumber.dc.html`，外壳直接使用 Input 的四变体、三尺寸与焦点/错误/只读反馈，数字不做滚动或翻页动画。

```tsx
import { Field, NumberInput } from "@violet/ui";

<Field label="价格" hint="0–9999 元">
  <NumberInput name="price" defaultValue={12.5} min={0} max={9999}
    step={0.5} precision={2} leading="¥" controls="stacked" />
</Field>
```

## 公开接口与 DOM 归属

- `variant="filled" | "outline" | "underline" | "plain"`，默认 filled；`controlSize="sm" | "md" | "lg"`，默认 md。原生 `size` 继续表示字符宽度。
- `controls="sides" | "stacked" | "none"`，默认 sides。分别是两侧减/加、右侧上下箭头、无按钮；none 仍有 ↑↓ 步进。
- `step` 默认为 1；正有限数生效。`precision` 默认由 step 的小数位推导，支持科学计数的步长；显式精度为 0–100 的整数。提交与步进四舍五入，固定精度显示，避免 `0.1 + 0.2` 的尾差。
- `min`、`max` 是上下界；输入期间不强行夹住草稿，提交时才夹范围。调用方提供有序且与 precision 一致的有效边界。
- `allowEmpty` 默认 true：空白提交为 null，展示空串。不允许空值时恢复上一提交值；没有初值则恢复 min 或 0。
- `leading` / `trailing` 是前后置的非交互槽。`classNames.control` 属于外壳，其他槽与 Input 相同。
- `value` / `defaultValue` 支持 string 或 number。字符串允许表达 `-`、`1.` 等编辑草稿。`className`、style、ref、id、name、form 与原生事件均属于真实 input，不落在外壳或隐藏代理上。ref 保留 React 19 callback cleanup。
- `disabled`、`readOnly` 为原生输入属性，并禁用所有步进按钮；只读仍能聚焦、选中、复制。`invalid` 与 `aria-invalid` 接 Field，范围外草稿也会自动标错。错误文案、标签、描述由外部 Field 管理，不在控件内部重复渲染。

## 草稿、提交与事件

输入区固定为 `type="text" inputMode="decimal" role="spinbutton"`，不会产生浏览器原生数字箭头或滚轮改值。数值合法时提供 `aria-valuenow`，并带上 `aria-valuemin` / `aria-valuemax`；不可解析的草稿不谎报一个数值。

`onChange(event)` 是真实原生输入链：每次草稿输入都会收到事件；步进、Enter、Esc 恢复、blur 规范化和粘贴写回通过真实冒泡 input 事件进入同一链。`event.currentTarget` / `event.target` 就是 ref 指向的 input。只有文本实际改变才补发 input，不伪造 ChangeEvent 对象。

`onValueCommit(number | null)` 不重复 draft 回调：仅 Enter、blur 或步进改变上一次**已提交数值**时触发。键入合法数字也不会提前触发；Esc 放弃不触发。格式从 `1.` 规范为 `1` 但数值未变时，只发原生 onChange，不重复数字提交。父组件若只关心提交后的数字，可用此回调；若以 `value` 控制文本，仍须在原生 onChange 中同步草稿。受控值最终由父层决定，未接受的文本不会偷偷保留在 DOM。

```tsx
const [draft, setDraft] = useState<string | number>(10);
<NumberInput value={draft} onChange={(event) => setDraft(event.currentTarget.value)}
  onValueCommit={(number) => saveQuantity(number)} />
```

## 原生表单与 react-hook-form

`<NumberInput {...register("quantity")} />` 可直接接线：ref、name、onChange、onBlur 均作用于真实输入。blur 会先规范化并发出 input，再让外部 onBlur 观察最终文本。FormData 提交当前 DOM 文本，disabled 输入按原生规则排除；不增加同名隐藏字段。`form` 支持外部表单归属。

节点是 text，直接读取 DOM 的 `valueAsNumber` 会得到 NaN。当前 react-hook-form 的 `valueAsNumber: true` 按输入文本转数值，仍可使用，空串转为 NaN；需要不同的空值语义时改用 `setValueAs`，不要同时配置两者：

```tsx
<NumberInput {...register("quantity", {
  setValueAs: (text) => text === "" ? undefined : Number(text),
})} min={0} max={100} />
```

非受控 form.reset 恢复 defaultValue，同时复位上次提交基准；取消 reset 不改草稿或基准，不额外发 change/数字提交。受控 reset 仍以宿主 value 为准。组件不把草稿藏在另一份受控 state 中，外部 ref 写值后正常派发 input 也能参与后续步进和提交。

## 输入与键盘

- 聚焦全选，可直接覆盖；不替换 input 节点。
- ↑ / ↓ 从当前可解析草稿加减 step；Shift 为 10 倍。停在边界，不循环；到边界时对应按钮原生 disabled。
- Enter 规范化，不阻止表单原生提交；Esc 放弃当前草稿，恢复上一次提交值。
- blur 将合法数字四舍五入并夹范围，非法草稿恢复上一次提交值；`-`、`1.` 可在编辑过程中存在。
- 粘贴先清掉空白、英文/中文千分位、货币前缀与文字/百分比等单位后整体识别。`￥ 1,234.50 元` 可识别，`1.2.3` 或 `12oops34` 整段拒绝，不抽取其中部分数字。在当前选区插入清洗后的文本，组合结果非法时也整段丢弃。
- 不响应滚轮，但不阻止页面滚动。输入法组合期间不截获数字键盘操作。
- 外部 onKeyDown / onPaste / onFocus 的 preventDefault 取消相应内部动作。

## 步进与样式

步进按钮的可访问名称为「增加」「减少」，`tabIndex=-1`；键盘用户只需停在 spinbutton 使用 ↑↓。按下立即走一步，420ms 后启动每 80ms 的连续步进；松开、移出按钮、pointercancel、失去捕获、输入失焦、窗口失焦、禁用/只读与卸载均停止。普通指针 click 不会把 pointerdown 已做的一步再算一次，辅助技术触发的 click 仍可步进。

样式入口 `@violet/ui/components/number-input.css` 自带 Input CSS 依赖。BEM `.v-number-input` 只提供布局和步进按钮，外壳继续是 `.v-input-control`；步进悬停 120ms、按下 60ms，只动颜色。减弱动态时直接切色，外壳涟漪沿用 Input 的静止契约。侧置按钮保留至少 32px 的实际命中宽度，触屏 36px，视觉圆底比外壳矮 8px；紧凑上下布局在右侧共享同一列。

## 验收边界

同目录行为测试覆盖草稿/提交差异、范围及非法恢复、精度、粘贴整段拒绝、事件取消、FormData/ref/reset 与取消复位、受控外部更新、只读/禁用和长按清理。独立 `/ui` number-input 展品包含四种变体、三布局、三尺寸、聚焦、范围错误、只读、禁用与提交反馈。真实浏览器的明暗、窄屏、触屏命中与长按仍需由集成验收执行；本文不将未运行的检查写为通过。
