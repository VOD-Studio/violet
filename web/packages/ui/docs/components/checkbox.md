# Checkbox

Checkbox 用于独立确认或一组多选项，状态是 `false`、`true` 或 `"indeterminate"`。它属于 foundation：React 的视觉与公开 CSS 来自同一个组件单元，键盘与表单桥接使用 Radix Root，组件处理表单取消 reset 与校验焦点。

## 命名与交互

Root 是 `type="button"`、`role="checkbox"` 的可聚焦元素。使用 `id` 与 Label 的 `htmlFor` 关联名称；没有可见标签时必须提供 `aria-label` 或 `aria-labelledby`。`className`、`style`、事件和 `ref` 都属于这个 button，ref 类型是 `HTMLButtonElement`，不是表单内的隐藏 input。

```tsx
import { Checkbox, Label } from "@violet/ui";

<div>
  <Checkbox id="terms" name="terms" value="accepted" required />
  <Label htmlFor="terms">接受服务条款</Label>
</div>
```

Space 切换状态；Enter 不切换，也不提交外层表单。点击半选项会请求 `true`。组件维护勾选指示器，因此不提供 `children` 或 `asChild`。文字标签放在 Root 外，由关联属性连接。

外部 `onClick` 调用 `preventDefault()` 可以取消内部切换；`onKeyDown` 取消 Space 的默认行为时，不发生浏览器按钮激活。`disabled` 使用真实 button 禁用属性，禁止点击和键盘聚焦。`aria-invalid` 表达错误状态，错误说明由调用方通过 `aria-describedby` 关联。

## 状态与表单

`checked` 由调用方控制，`onCheckedChange` 请求新状态。`defaultChecked` 提供非受控初值，连续激活按最新状态逐次切换；受控请求继续由宿主确认。聚合父项的半选状态由调用方根据子项推导；组件不管理多选集合。

```tsx
<Checkbox
  checked={allSelected ? true : someSelected ? "indeterminate" : false}
  onCheckedChange={(next) => setSelected(next === true ? allIds : [])}
  aria-label="选择当前页全部项目"
/>
```

在 form 内，Radix 提供隐藏 input 桥接原生表单。`name` 与 `value` 参与 FormData，value 默认为 `"on"`；只有选中且未禁用的控件被提交。半选代表聚合状态，隐藏 input 不按选中提交。`required` 同时提供 `aria-required` 与表单约束。表单外的 Checkbox 可使用 `form="表单ID"` 指定所属表单。

`form.reset()` 在 reset 事件传播结束后恢复非受控控件挂载时的初始状态。宿主的 `onReset` 调用 `preventDefault()` 时，当前状态与表单值保持不变，也不调用 `onCheckedChange`。受控控件继续由宿主持有状态；正常 reset 请求挂载初值，宿主决定是否接受请求，隐藏 input 的提交值继续跟随受控值。

取消 reset 必须等完整事件传播结束后确认。原生 reset 按钮的默认动作可能在捕获与冒泡之间执行微任务，组件确认事件已结束传播后才处理复位；同一个事件在多个作用域被捕获时仍只处理一次。

reset 按控件的实际 DOM 作用域捕获，支持 ShadowRoot 内的表单与尚未接入 document 的容器。容器随后接入 document 时，同一个 reset 只处理一次；外部表单归属继续使用原生 `form` 属性。

原生校验聚焦隐藏 input 时，组件将焦点交回可见 Root，Space 继续通过正常回调切换状态。`checkValidity()` 本身不改变焦点。改变 `form` 属性、晚挂载表单或以同一 ID 替换表单时，reset 按事件派发时 button 的真实归属处理；旧表单的 reset 不影响当前控件。实际 button、ref、当前勾选状态和键盘焦点在换绑时保留。包装元素使用 `display: contents`，保持 button 的布局属性与相邻标签间距。

## 属性

| 属性 | 类型 | 默认值 | 约束 |
| --- | --- | --- | --- |
| `checked` | `boolean \| "indeterminate"` | — | 受控状态 |
| `defaultChecked` | `boolean \| "indeterminate"` | `false` | 非受控初值 |
| `onCheckedChange` | `(checked: boolean \| "indeterminate") => void` | — | 请求最新状态 |
| `variant` | `"default" \| "primary"` | `"default"` | default 使用 `--primary`；primary 使用可替换的 `--primary-base` |
| `size` | `"sm" \| "default" \| "lg"` | `"default"` | 盒面为 14、16、20px；触摸场景通过关联标签扩大操作范围 |
| `disabled` / `required` | `boolean` | `false` | 保留 primitive 的表单和可访问性语义 |
| `id` / `name` / `value` / `form` | button / Root 对应属性 | — | 命名与表单归属；value 默认 `"on"` |
| `ref` | `Ref<HTMLButtonElement>` | — | 指向 Root |

其余可访问性属性和 button 事件继续透传。变体与尺寸类型由 `checkboxVariants` 推导，它只输出 BEM 类名；组件内部不再维护 Tailwind 外观。

## CSS 与 HTML

Tailwind 宿主在 Tailwind 后导入 `@violet/ui/styles.css`。普通 CSS 宿主可仅加载 tokens 与 Checkbox 叶子样式：

```css
@import "@violet/ui/tokens.css";
@import "@violet/ui/components/checkbox.css";
```

```html
<label>
  <input type="checkbox" name="terms" value="accepted" class="v-checkbox v-checkbox--primary" />
  接受服务条款
</label>
```

原生 input 保留浏览器勾选图形与 `accent-color`，没有 Indicator 子节点，也不承诺与 React 的 SVG 指示器逐像素一致。原生半选通过 `input.indeterminate = true` 设置，不能把 `data-state` 当成原生勾选值。自定义 `role="checkbox"` 的 HTML 需要自行实现状态、键盘和表单行为，CSS 只提供外观。

CSS 支持 `data-state="checked|unchecked|indeterminate"`、原生 `:checked` / `:indeterminate`、disabled、焦点和错误状态。反馈使用颜色与透明度；减弱动态关闭过渡和指示器动画，高对比模式使用系统颜色。尺寸与语义色通过局部变量或 utilities layer 调整，保留焦点和错误提示。

## 验证范围

组件契约测试覆盖关联标签、受控与非受控状态、半选、同批次连续激活、事件取消、object / callback ref 与 React 19 清理、FormData、正常与取消 reset、ShadowRoot 与独立容器的表单、同值不重复通知、required 校验焦点、外部 form 换绑、晚挂载与替换表单、已移除表单的 reset 和 SSR 输出。Space 激活、无效提交后的焦点与原生表单行为需在真实浏览器检查；安装包通过独立 tarball 消费验收公开类型、Root 入口和叶子 CSS。

`web/e2e/ui-checkbox.spec.ts` 永久覆盖 reset 按钮的指针、Space 与 Enter 激活，检查取消和正常复位后的 Root、隐藏 input、FormData 与回调次数，并覆盖晚挂表单、ShadowRoot 和受控拒绝复位。该测试通过 `pnpm test:contract` 进入现有浏览器验收。
