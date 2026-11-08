# DatePicker 与 DateRangePicker

本地日期、日期时间、时间与日期范围选择。触发器复用 Input 的四种外观和三档尺寸；文本可以直接编辑，日历与时分面板负责精确选择。组件不做 UTC 转换，不包含时区选择器，也不渲染字段标签或错误文案。

```tsx
import { DatePicker, DateRangePicker, type DateRange } from "@violet/ui";
import { useState } from "react";

function PublishFields() {
  const [published, setPublished] = useState("2026-11-03T09:30");
  const [period, setPeriod] = useState<DateRange>({
    start: "2026-11-01",
    end: "2026-11-07",
  });

  return (
    <>
      <DatePicker
        aria-label="发布时间"
        name="published_at"
        mode="datetime"
        value={published}
        onChange={setPublished}
      />
      <DateRangePicker
        aria-label="统计区间"
        name="period"
        value={period}
        onChange={setPeriod}
      />
    </>
  );
}
```

完整样式使用 `@violet/ui/styles.css`；按需 CSS 使用 `@violet/ui/tokens.css` 和 `@violet/ui/components/date-picker.css`。日期单元的 CSS 已包含 Input 外壳、共享浮层与列表高亮依赖，不需要宿主手工拼接内部样式。

## 公开 API

### DatePicker

`DatePickerProps` 继承原生 Input 的文本属性，但 `value`、`defaultValue`、`onChange`、`type`、`min`、`max` 与装饰槽由日期单元管理。`onChange` 是提交规范值的回调，不是原生 ChangeEvent；要观察输入中的草稿可使用原生 `onInput`。不能把 `register()` 返回的事件版 `onChange` 直接展开给它，表单库应使用其受控适配器。

| 属性 | 契约 |
| --- | --- |
| `mode` | `DatePickerMode`：`date`（默认）、`datetime`、`time` |
| `value` / `defaultValue` | 字符串；空字符串表示未选择。受控时显示值由宿主最终决定 |
| `onChange(value)` | 只有成功提交、清除或选择有效预设时调用；相同的显式预设仍会调用 |
| `min` / `max` | 含边界，采用当前 mode 的本地格式；datetime 精确到分钟 |
| `disabledDate(date)` | 禁用整个日期，面板点击、键入和键盘选择均遵守；time 模式不调用 |
| `presets` | `readonly DatePickerPreset[]`；每项 `{ label, value }`，空 `value` 是清空预设 |
| `clearable` | 默认显示有值时的清除钮。`false` 只隐藏按钮，不限制清空输入或空预设 |
| `required` | 原生必填，同时禁止清除与空预设 |
| `open` / `defaultOpen` / `onOpenChange` | 浮层受控或非受控状态；disabled/readOnly 时不会展开 |
| `container` | Portal 容器，默认 body |
| `collisionBoundary` | Radix 碰撞边界；陈列室应与 container 使用同一舞台元素 |
| `variant` | `filled`、`outline`、`underline`、`plain`，与 Input 一致 |
| `controlSize` | `sm`、`md`、`lg`，与 Input 一致；原生 `size` 仍为数字 |
| `invalid` / `valid` | 外壳状态；显式 invalid 优先于传入的 aria-invalid，内部解析失败也会标记非法 |
| `ref` / `id` / `className` / `style` | 均属于真实文本 input；`classNames.control` 属于外壳 |


同一入口还导出 `parsePickerValue(value, mode): Date | null` 与 `formatPickerValue(date, mode): string`，便于消费方沿用相同的严格本地解析和规范输出。解析失败返回 null；格式化函数的参数应是有效 Date。
提交格式：

- `date`：`YYYY-MM-DD`，例如 `2026-11-07`。
- `datetime`：`YYYY-MM-DDTHH:mm`，例如 `2026-11-07T09:30`。
- `time`：`HH:mm`，例如 `09:30`。

公开类型为 `DatePickerMode`、`DatePickerProps`、`DatePickerPreset`、`DateRange`、`DateRangePreset` 和 `DateRangePickerProps`。不提供 `DateTimePicker` / `DateTimeRangePicker` 别名；日期时间使用 `mode="datetime"`。

### DateRangePicker

`DateRangePickerProps` 继承单值的外观、原生输入和浮层属性，用以下范围契约替换对应部分：

| 属性 | 契约 |
| --- | --- |
| `mode` | `date`（默认）或 `datetime`，不接受 `time` |
| `value` / `defaultValue` | `DateRange`：`{ start?: string; end?: string }`；缺省端点代表开放边界 |
| `onChange(range)` | 一次提交整个范围；两个端点按先后顺序排序，datetime 排序包含时分 |
| `allowOpenEnded` | 默认 true。false 时拒绝单端点提交；非 required 仍可整体清空 |
| `required` | 两个原生输入都必填，不允许开放区间或整体清空 |
| `presets` | `readonly DateRangePreset[]`；每项 `{ label, value: DateRange }`。省略时提供今天、最近 7 天、最近 30 天、本月、上个月；传 `[]` 隐藏 |
| `name` | 自动派生两个原生名字：`${name}.start` 与 `${name}.end` |
| `startName` / `endName` | 分别覆盖自动派生的名字 |
| `endInputProps` | 结束输入的 id、ref、可访问名称、placeholder、事件等原生属性；值、表单归属、禁用/只读/必填由范围统一管理 |
| `ref` / `id` / `className` | 属于起点输入；结束输入默认 id 为 `${id}-end`，未传 id 时使用稳定生成 ID |

两段输入共用一个外壳，中间是“至”。起点点击开始一次两步范围选择；第一次选择后提示终点，第二次选择完成，早于起点时自动对调。直接点击结束输入可保留原起点，只改终点。指针或键盘移动仅预览，不发送 onChange。开放区间可以键入、通过预设提交，或在选了一个端点后点确定提交。

日期模式第二次选日立即提交并关闭；日期时间模式先调整日期与两个端点的时分，再点确定提交。取消、Esc、点外面或离开浮层会放弃尚未提交的面板选择；已经通过文本 Enter/blur 成功提交的值不回滚。

预设也必须满足 min/max、disabledDate、required 和开放区间规则。范围预设会先规范化格式，再按时间排序。默认相对预设按浏览器本地今天计算；datetime 的日区间从 00:00 到 23:59，不隐含秒或毫秒。

## 草稿、解析与提交

- 日期接受 `2026-11-07`、`2026/11/7`、`2026.11.7`；同一个日期内不能混用分隔符。年份是 1–9999 范围内的四位数字。
- datetime 还必须包含时分，如 `2026/11/7 9:30` 或 `2026-11-07T09:30`；time 接受 `9:30`。小时 0–23，分钟必须两位且为 00–59。
- Enter 或失焦时解析。闰年、每月天数、日期溢出、非法时分与不存在的本地时刻均严格检查，不把 2 月 30 日归一化到 3 月。
- 无效、越界或被禁用的草稿恢复最后一次提交值，并设置 aria-invalid；后续输入或成功选择会清除内部错误状态。错误说明由外部 Field 通过 aria-describedby 接线。
- 普通左右键属于输入光标。Enter 遇到未提交草稿时优先解析文本，不选中日历里的另一天。
- 单日期点击一天或“今天”立即提交；datetime/time 的面板变化暂存，“现在”更新暂存值，“确定”才提交。直接键入完整合法文本仍在 Enter/blur 提交。
- min/max 包含边界。datetime 边界当天仍可选，但时间列表只允许合法时分；选该日期时会把暂存时分夹到边界。
- 所有值均为本地墙钟字符串。宿主若需要绝对时刻，应在提交后明确选择时区和转换规则，不能直接把本地字符串当 UTC。

## 键盘与无障碍

点击或聚焦输入打开，再次点击输入不关闭。日历单元和月份按钮不加入 Tab 序列，指针点击不会把焦点从输入夺走。输入通过 aria-expanded、aria-controls、aria-haspopup="dialog" 与 aria-activedescendant 描述日历状态。

| 按键 | 行为 |
| --- | --- |
| `←` / `→` | 在输入文字内移动光标，不导航日期 |
| `↑` / `↓` | 日历前/后一周，跳过禁用日 |
| `PageUp` / `PageDown` | 前/后一个月，月底夹到目标月最后一天 |
| `Shift + PageUp/PageDown` | 前/后一年 |
| `Alt + ←/→` | 前/后一天，跳过禁用日 |
| `Enter` | 草稿优先解析；否则选择活动日。月份视图则进入活动月份 |
| `Esc` | 关闭浮层，不把焦点移到别处 |
| `Tab` | 正常顺序移动；离开输入与面板整体时关闭 |
| 时分列内 `↑` / `↓`、`Home` / `End` | 移到前后合法值或列的两端，更新暂存时分 |

点击年月标题进入 12 个月视图，上下导航按钮改为换年；选择月份回到日历。月份视图上下键移动三个月、Alt 左右移动一个月、PageUp/PageDown 换年。切换视图保持同一日历区域高度。

日历是 dialog 内的 grid，包含 row/gridcell 和原生日期按钮。每个日期的 aria-label 都是完整中文日期，例如“2026 年 11 月 3 日 星期二”；已选择按钮使用 aria-pressed，今天使用 aria-current="date"。范围起点选择通过 polite status 读出“已选起点 11 月 3 日，请选终点”。星期一在每周第一列，相邻月日期可点但不参与当前月选中或范围高亮。

disabled 输入不可操作；readOnly 输入仍可聚焦与复制，但没有日历图标，不打开面板。消费方必须提供 label 或 aria-label，并把描述/错误通过 aria-describedby 传入。

## 原生表单与事件

- ref、id、required、disabled、readOnly、autoComplete 都落在可见的原生文本输入。`mode="date"` 与 `time` 的 `name` 也在可见输入上；`datetime`（含范围）的输入显示成空格分隔的 `2026-11-03 09:30`，`name` 改由同名隐藏输入承载规范的 `YYYY-MM-DDTHH:mm`（范围为 `name.start`、`name.end`），所以原生提交、onChange 与受控 value 是同一种格式。
- 提交的是已提交值（`value`），不是输入中的草稿；要取得已提交值读 onChange/value，不要把 FormData 当成额外提交回调。
- 非受控 reset 恢复 defaultValue；受控 reset 恢复宿主 value；两者都不发送 onChange。reset 被 preventDefault 取消时不改值。范围两个输入同步复位。
- 原生 onFocus/onClick/onBlur/onKeyDown 先调用消费方；preventDefault 会取消对应内部行为。结束输入可用 endInputProps 提供独立事件。
- 外壳点击会打开日历并聚焦输入。右侧只有一个图标位：没有值时是日历（或时钟）图标，有值且可清除时，悬停或聚焦会让清除钮顶替图标，图标不再占位也不能被点；日历图标不进 Tab 序列，键盘用户靠聚焦输入打开。清除钮不触发外壳再次打开。面板不锁页面滚动，点外部可聚焦元素时保留用户那次焦点移动。
- 范围触发器的两个输入等宽，中间是一个箭头；展开或聚焦时，输入下方有一条 2px 的指示条标出当前编辑的是开始还是结束，切换端点时它在两个输入之间平移 220ms。当前端点同样由外壳的 `data-endpoint="start|end"` 暴露。

## 布局与动态

面板宽度跟随内容，不取触发器宽度：单月固定 252px，日格 36px、圆底 32px；范围双月间距 28px，预设区 128px；时分列各宽 60px，列表上下做 14px 渐隐，裁出的半格不显得突兀。面板以 viewport 与 Radix 可用宽高为上限，窄屏在面板内部横向滚动，不缩小或裁掉月份与时间列；低高度视口可纵向滚动整个面板。滚动区留出焦点环内边距。

日期时间范围的两段端点时间分别排在两个月历下方，各带「开始时间 09:30」「结束时间 18:00」的标题行和紧凑的可滚动时分窗口，不把长列表完整撑开。陈列室 `datePickerExhibit` 声明 800×720 舞台，展开态仍挂在舞台容器并使用该容器作碰撞边界；实际浏览器应分别检查双月、datetime-range、窄屏滚动与焦点可见性，不能仅用 footprint 声明作为验收结果。

浮层沿用共享 v-float：展开 200ms、6px，收起 140ms、4px。换月沿时间方向平移 20px 并淡入（下个月从右、上个月从左，240ms），平移被裁在日期区内，不会撑出横向滚动条；12 个月视图仍是 180ms 透明度变化。范围带和选中圆随日期变化有 140ms 的底色过渡，预览带跟着指针扩展。收起时面板整体复制为退场副本，副本里的月份入场动画被关闭，否则选完日期关闭的 140ms 内日历会从透明重新淡入而闪烁。预设与时分列表使用 ListHighlight。减弱动态关闭月份平移、日期状态过渡与指示条平移，浮层仅保留共享的 100ms 透明度。
