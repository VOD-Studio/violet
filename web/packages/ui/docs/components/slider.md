# Slider 滑块

在一个范围里粗调一个值或一段区间。看效果比看数字重要时使用；精确数值使用 NumberInput，只有两到四个离散选项时优先用 Segmented。

## 使用

```tsx
import { Slider } from "@violet/ui";

<Slider
  aria-label="正文字号"
  name="fontSize"
  min={12}
  max={24}
  defaultValue={[16]}
  formatValue={(value) => `${value} 像素`}
/>;

<Slider
  aria-label="阅读时长"
  name="duration"
  min={1}
  max={60}
  defaultValue={[5, 20]}
  thumbLabels={["起点", "终点"]}
  formatValue={(value) => `${value} 分钟`}
/>;

<Slider
  aria-label="背景装饰"
  defaultValue={[50]}
  marks={[
    { value: 0, label: "无" },
    { value: 25, label: "稀" },
    { value: 50, label: "适中" },
    { value: 75, label: "密" },
    { value: 100, label: "满" },
  ]}
/>;
```

React 导出 `Slider`、`SliderProps`、`SliderMark`。普通 CSS 消费先加载 `@violet/ui/tokens.css`，再加载 `@violet/ui/components/slider.css`；完整站点入口为 `@violet/ui/styles.css`。视觉只在组件同目录的 BEM CSS 中维护。

## 值与属性归属

- 沿用 Radix 数组接口：单值 `[value]`，区间 `[start, end]`，最多两个值。`value` 受控，`defaultValue` 提供非受控挂载初值，不同时使用。范围值按升序规范化，交互中每个滑钮身份固定，允许两个值相等但不交叉。
- `min`、`max`、`step` 默认分别为 `0`、`100`、`1`；调用方提供有限数字、`max > min`、`step > 0` 及一个或两个值。
- `onValueChange(number[])` 是实时变更请求。受控模式在宿主回写前不改变显示与表单提交值。`onValueCommit(number[])` 在一次确实改变值的拖动松手时或键盘调节时触发；表单复位不产生交互提交回调。
- `marks: readonly SliderMark[]` 的每项含 `value: number` 和 `label: string`。刻度可以不等距，也不必与 `step` 对齐；给出有效刻度即吸附到最近的刻度。范围以外的刻度忽略。调用方提供不同的刻度值。
- 不传 `formatValue` 时，刻度滑块以档位名显示提示和 `aria-valuetext`，连续值显示数字；`formatValue(value, index)` 同时覆盖提示和读屏文本，单位必须写在这里，而不是只写在旁边的文字里。
- `ref`、`className`、`style`、`id` 及原生指针/键盘事件属于 Radix 轨道根 `HTMLSpanElement`，不是隐藏 input，也不是某个滑钮；在 Field 内，Field 的控件 ID 例外，属于第一个滑钮，使错误汇总的 `focusField` 能把焦点移入可操作控件。`aria-label` / `aria-labelledby`、`aria-describedby`、`aria-invalid` 接到每个可聚焦滑钮。
- `thumbLabels` 指定各滑钮的名称后缀。区间默认「起点」「终点」，会与滑块整体名称组合。单值一般只需整体名称。
- `invalid` 显式优先于 `aria-invalid`。标签、错误与帮助信息归外部 Field；组件不创建消息系统。`readOnly` 保留键盘焦点与表单值，但阻止调节；`disabled` 不进入 Tab 序列，不响应调节，也不参与表单提交。
- 在 Field 内通过 `useFieldControl` 自取标签、描述、错误与控件 ID，不依赖 `<label for>` 为非原生滑钮命名；整体 Field 名称会接到每个滑钮，区间另加起点/终点后缀。显式 `aria-label` 或 `aria-labelledby` 优先于 Field 名称；描述 ID 与 Field 消息合并去重，显式 `invalid` 优先。

## 表单与 reset

有 `name` 时渲染原生隐藏 input：单值提交 `name=value`；区间沿用 Radix 数组约定，以 `name[]=start`、`name[]=end` 两个条目提交。`form` 可以关联外部表单。隐藏值跟随实际显示值，禁用时省略。

非受控滑块在所属表单原生 `reset()` 后回到挂载时的初值；监听完整传播后的 `defaultPrevented`，取消 reset 不改值。受控滑块的 reset 仍由宿主管理，不私自覆盖 `value`。不把隐藏值当成表单校验输入；复合表单的校验与错误说明由 Field/宿主管理。

精确数值组合由宿主持有同一个值数组，把 `value[0]` 传给数字输入，输入确认的数字重新写为 `[next]`；组件不内置第二个数字框或独立草稿值。

## 指针与键盘

基础轨道、触摸指针捕获、拖动与滑钮角色使用已安装的 Radix Slider primitive。该版本原生会对跨越值排序并交换激活身份，Home/End 作用于首末滑钮，Page 固定十步；本组件补上设计稿所需的固定身份边界与键盘语义，不用视觉 div 冒充滑块。

| 操作 | 行为 |
| --- | --- |
| 点击轨道 | 最近的滑钮移到点击位置，可立即接着拖 |
| 拖动滑钮 | 实时更新；范围滑钮到另一滑钮处停止，反向拖回仍控制原滑钮 |
| ← / ↓ | 减一步；有刻度时回到前一档 |
| → / ↑ | 加一步；有刻度时进入后一档 |
| Shift + 方向键 | 十步；刻度模式十档，到边界停止 |
| PageUp / PageDown | 加减整个数值范围的 10%，再按步长/刻度吸附 |
| Home / End | 当前滑钮到允许的最小/最大值，不移动另一滑钮 |

调用方 `onKeyDown`、`onPointerDown` 等事件先执行；`preventDefault()` 取消该事件的内部调节。每个滑钮都带 `role="slider"`、`aria-valuenow`、随另一滑钮变化的 `aria-valuemin/max` 和 `aria-valuetext`。

## 外观与动态

轨道高 4、圆角 2、凹陷底色；连续值已走过部分和区间两滑钮之间为墨色。滑钮为 18 的纸色圆，1px 次级描线加唯一 `--shadow-soft`，悬停描线加深，键盘聚焦为 2px 强调色环。轨道上下扩展点击区域，触屏滑钮为 24 并扩展到 44 的命中区域。禁用整体透明度为 45%。

拖动不加位置过渡。点击轨道的位置变化为 160ms、`cubic-bezier(.32,.72,0,1)`；开始拖动立即取消该过渡。数值提示位于滑钮上方 8，拖动或键盘焦点时从下方 4px 浮出并淡入 150ms，结束后 120ms 淡出。提示不参与名称计算，也不接收指针。减弱动态关闭全部过渡并去除提示位移。

## 行为测试与陈列

`src/components/slider/__tests__/slider.test.tsx` 覆盖连续值和小数键盘、区间固定身份与上下界、不等距刻度与非 step 对齐吸附、点击后触屏拖动、受控请求/回写、FormData/外部表单/reset 取消、禁用与只读、事件取消、每钮命名/错误描述、数字输入共享状态。`sliderExhibit` 独立展示单值、范围、刻度、配数字输入和禁用，并提供真实聚焦、只读、错误和整组禁用状态。

本单元编写阶段未运行检查、测试或浏览器验收；集成者需执行包检查、类型、行为测试、构建、真实 tarball consumer 与实际消费页视觉/交互验收。
