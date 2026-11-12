# Field：表单项

`field` 单元把一个控件包成表单里的一项：标签、提示、错误与字数。控件本身不管这些；什么时候检查、错误怎么写也在这里定。`Label` 并入本单元，导出名与行为不变。

```tsx
import { Field, Input } from "@violet/ui";

<Field label="邮箱" optional hint="只用于回复通知，不会公开" error={emailError} count={{ value: bio.length, max: 40 }}>
  <Input type="email" autoComplete="email" />
</Field>
```

## 结构与消息

- `labelEnd` 把说明入口之类的附件放在标签行里紧跟标签（在 `<label>` 之外）。
- `label` 必填；可访问名称只取这段文案。「（选填）」（`optional`）是 `<label>` 的兄弟节点，不在 `<label>` 里。必填不加红星。
- 消息行恒占一行高（`min-height: 20px`）。提示与错误是同一个元素、同一个位置，永远只显示一条，优先级 `error` > `checking` > `success` > `hint`；该元素带 `aria-live="polite"`，错误前有 14px 警示图标。切换没有过渡动画。
- `count` 在消息行右端显示 `值 / 上限`，值达到上限 90% 变危险色；字数只是展示，不截断输入。
- `success` 只给异步检查通过这类确有意义的时刻；普通字段对了什么都不显示。

## 控件接线

`children` 是单个 React 元素时，Field 把 `id`、`aria-describedby`（与控件自带的值合并）、出错时的 `aria-invalid` 合进去，`<label for>` 指向同一个 id。控件上显式写的同名属性优先，包括 `id`。

`children` 不是单个元素（或控件是组合控件）时不注入：用 `htmlFor` 指定标签目标，或在组合控件内部调用 `useFieldControl()` 取 `{ id, "aria-labelledby", "aria-describedby", "aria-invalid" }` 展开到合适的节点。`aria-labelledby` 指向标签元素：`<label for>` 命名不了 `role="group"` 之类的组合控件，由它提供可访问名称；原生表单控件不需要，自动接线也不注入，名称不会重复。在 Field 之外调用返回空对象。

## 横排

`orientation="horizontal"` 是设置页的排法：标签 160px 在左，控件至多 420px 在右，提示在控件下面，标签行高与控件高对齐（`controlSize` 对应 32 / 36 / 40，触屏各加 4）。**窄于 36rem 回到纵向，按 Field 自身的宽度（容器查询），不是视口**，所以对话框、抽屉里同样成立。横排的 Field 自成 `inline-size` 容器，不要放进按内容收缩宽度的 flex 行里。

## FieldSet

几个选项属于同一个问题时用 `FieldSet`：`<fieldset>` + `<legend>`，`description` 在组名之下，选项在中间，选项下方的消息行承载组的 `hint` 与 `error`；`fieldset` 的 `aria-describedby` 指向它。选项自己的标签由调用方写。

## 提交汇总

`FieldSummary` 放在表单最上面，`errors` 是 `{ id, label }[]`（`id` 是控件 id，`label` 只写字段名）。为空渲染 `null`；否则 `role="alert"`，每一条是按钮，点击调用 `focusField(id)`。提交失败后由调用方先把焦点移到第一个错误控件。`focusField(id)` 找到元素并聚焦返回 `true`，找不到返回 `false`。

## useFieldCheck：检查时机

```tsx
const check = useFieldCheck({
  value,
  validate: (v) => (/^\S+@\S+\.\S+$/.test(v) ? undefined : "邮箱格式不正确，缺少 @ 或域名"),
  validateAsync: async (v, signal) => ((await taken(v, signal)) ? "已被占用，换一个试试" : undefined),
});

<Field label="用户名" error={check.error} checking={check.checking ? "正在检查…" : undefined} success={check.valid ? "可以使用" : undefined}>
  <Input value={value} onChange={(e) => setValue(e.target.value)} {...check.fieldProps} />
</Field>
```

纯逻辑，不渲染、不接线，不是表单引擎；值仍由调用方持有。

- 同步错误在失焦（`fieldProps.onBlur`）或 `touch()` 之前不显示，之后随值实时重算，改对即消。`revealOn: "change"` 改为边输入边显示，用于复选组之类没有失焦的控件。
- 异步检查只在同步通过且值非空时发起，值停手 `asyncDelay`（默认 600）毫秒后才发；每次改值取消上一次计时并 `abort` 上一次请求；发起时 `checking` 为 `true`。异步错误不受失焦门控，结果到达即显示。请求抛出的错误（含中止）视为没有结论。
- `valid` 只在异步检查通过且值此后没变时为 `true`；值为空时不发异步，`valid` 为 `false`。
- `reset()` 回到未触碰、无异步结果；卸载时清理计时器并中止在途请求。

站点里的 react-hook-form 表单照旧，各自把 `errors.x?.message` 喂给 `Field` 的 `error`。

## 视觉边界

聚焦、出错、通过的控件外观归输入框；表单项只画标签、消息行、字数与汇总。颜色只用语义 token（文字用 `--destructive-text`、`--success-text`、`--muted-foreground`）；没有动效，减弱动态不需要特殊处理。
