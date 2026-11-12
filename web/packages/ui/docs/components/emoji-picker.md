# EmojiPickerPanel

无搜索框、无底栏的表情选择面板。宽 340px；分组标签行 46px；独立滚动的网格高 244px。内容、分组、插入规则、最近使用与收藏均由宿主提供，组件不发请求、不读写本地存储、不管理登录，也不决定浮层何时关闭。

## 受控组合

```tsx
import { EmojiPickerPanel, type EmojiPickerGroup, type EmojiPickerItem } from "@violet/ui";
import { useState } from "react";

const groups: EmojiPickerGroup[] = [
  {
    id: "faces",
    label: "小黄脸",
    sections: [
      {
        id: "system",
        label: "小黄脸",
        density: "small",
        items: [
          {
            id: "smile",
            name: "微笑",
            content: "😀",
            placeholder: "[微笑]",
            aliases: ["wx", "smile"],
          },
        ],
      },
    ],
  },
];

function ComposerEmojiPanel() {
  const [group, setGroup] = useState("faces");
  const [text, setText] = useState("");
  const select = (item: EmojiPickerItem) => {
    setText((value) => value + item.placeholder);
  };
  return (
    <>
      <textarea
        aria-label="评论内容"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <EmojiPickerPanel
        groups={groups}
        activeGroup={group}
        onGroupChange={setGroup}
        onSelect={select}
      />
    </>
  );
}
```

上例只演示数据流；真实编辑器由宿主在保存的光标处插入，而不是固定追加末尾。系统表情的 `placeholder` 传 `[名称]`，自定义表情传 `[名称:ID]`，颜文字传原文；组件原样回调整个 item，不推断或改写占位符。

## 公开类型

- `EmojiPickerItem`：`id: string`、`name: string`、`content: ReactNode`、`placeholder: string`；可选 `aliases: readonly string[]`、`disabledReason: string`、`selected: boolean`。ID 在同一 section 内唯一。
- `EmojiPickerSection`：`id`、`label`、`density: 'small' | 'large' | 'text'`、`items: readonly EmojiPickerItem[]`；可选 `action: ReactNode`、`emptyMessage: string`。
- `EmojiPickerGroup`：`id`、`label`、可选 `icon: ReactNode`、`sections: readonly EmojiPickerSection[]`。section ID 在分组内唯一，group ID 在面板内唯一。
- `EmojiPickerPanelProps` 继承 `Omit<ComponentProps<'div'>, 'onSelect'>`，支持 React 19 原生 ref；必传 `groups`、`activeGroup`、`onGroupChange(id)`、`onSelect(item)`；可选 `scrollTop`、`onScrollTopChange(value)`、`status: 'ready' | 'loading' | 'error'`、`errorMessage`、`onRetry()`。默认 `status='ready'`。

`className`、`style`、原生 div 属性及 ref 落在根 div。公开组件与全部接口从根入口和 `@violet/ui/emoji-picker` 导出；没有额外的 provider 或需要初始化的全局状态。

## 状态归属

| 状态 | 所有者与约定 |
| --- | --- |
| 当前分组 | 宿主受控持有 `activeGroup`；分组切换只回调 `onGroupChange` |
| 滚动 | 挂载期间组件按 group ID 记忆滚动；需要关闭卸载后恢复时，宿主按组保存 `onScrollTopChange` 的值，并传入该组 `scrollTop` |
| 最近使用 | 宿主把最近 16 项放在第一个 group；站点回应和评论共用设备存储，同一次打开内保留格子顺序，关闭后才应用新的最近顺序 |
| 收藏与上传 | 登录后宿主提供收藏 group；section `action` 放上传控件；上传、收藏请求与进度均留在宿主 |
| 不可用 | `disabledReason` 非空时带锁、图像变淡，但仍可导航和预览，不触发选值 |
| 已回应 | `selected=true` 显示浅底和对勾；可读名称追加「已回应」，不能再次选值 |
| 加载 | `status='loading'` 挂 `aria-busy`，只显示表情骨架与「正在加载表情」，不暴露旧选项 |
| 出错 | `status='error'` 显示 `role='alert'`、原因；传 `onRetry` 后显示可用的「重新加载」按钮，不擅自重试 |
| 空内容 | 空 section 显示 `emptyMessage`，上传 action 仍保留；未提供文案时显示「这个分组还没有表情」 |

写作场景把面板放进非模态 Popover，禁止容器打开时抢焦点，并把编辑区纳入允许交互范围，点击输入框不关闭。连续插入保持打开。回应场景由 MorphingPopover 承载变形接力，宿主在选中后关闭；不得向回应面板传收藏分组。面板自身没有浮层开关、焦点陷阱或外部点击监听。

## 键盘与读屏

- 标签为有名称的 `tablist` / `tab`，只保留当前标签一个 Tab 停靠点。左右方向键循环并立即换组，Home / End 到首尾；键盘换组后焦点随标签移动。左右箭头按钮与横向滚动支持分组溢出。
- 网格为有名称、可聚焦的 `listbox`；焦点留在网格，通过稳定的 `aria-activedescendant` 指向当前 option。左右逐项移动，上下按当前列位置找相邻行；跨 section 时按相对列位置选择最近项，Home / End 到整个分组首尾，Enter / Space 选择。
- 不可用和已回应项不跳过，读屏可得知原因；它们只阻止选值。名称、占位符、别名与不可用原因由 option 的可访问名称和描述提供，浮动预览对读屏隐藏，避免重复播报。
- pointer 按下表情、分组标签时 `preventDefault()` 保留原焦点，选值在 click 时执行；挂载不聚焦。所有表情格均为 `tabIndex=-1`。上传 action 保留自己的原生键盘与焦点行为，不冒充表情 option，也不触发表情的键盘选值。
- 键盘滚动后，静止指针引起的合成 mouseenter 不接管高亮，真实鼠标移动才重新接管。

## 外观与动效

小表情 10 列、30px 见方（内容 20px）；大表情 5 列、60px 见方（内容 38px）；颜文字 3 列、高 36px。网格两侧 10px，可滚动但不显示占用列宽的滚动条。上传 action 占第一格，并参加行列几何计算。

预览纸片默认 120 × 100px、内容 44px、名称 13px、辅助文字 11px，显示占位符、别名与原因。超长辅助内容限两行，完整文本同时保留在选项读屏描述中；预览不接收指针。优先放在网格视口内的上方或下方；上下均放不下时侧放，最多越过面板边缘 16px，同时避开浏览器边缘，必要时收窄侧放纸片。定位按面板本地坐标计算，父级缩放后仍对准目标，不覆盖目标格和分组标签。相邻预览只移动纸片位置，160ms；离开 60ms 后以 120ms 透明度退出。切组或进入加载、出错状态时立即隐藏，恢复内容不会自动复活旧预览。

标签浅底复用 ListHighlight 的单块 280ms 几何过渡，分组只做 140ms 透明度淡入；表情内容不做位移、缩放、滤镜或模糊。减弱动态（系统偏好或宿主 `data-motion='reduce'`）禁用骨架呼吸与所有几何过渡，仅保留 100ms 透明度。

React 与纯 HTML 共用 `emoji-picker.css`。Tailwind 宿主在 Tailwind 后加载 `@violet/ui/styles.css`；普通 CSS 宿主先加载 `@violet/ui/tokens.css`，再加载 `@violet/ui/components/emoji-picker.css`。叶子 CSS 已包含共享标签高亮的样式依赖。

## 展品与验收边界

`emojiPickerExhibit` 使用真实面板，提供小表情、大表情、颜文字、混合密度的最近使用、收藏与本地图片读取、空收藏、加载、错误重试、不可用与已回应九态。舞台占地 372 × 364px，四周为预览侧放预留 16px。展品上传只在本次会话读取并展示本机图片，不表示站点上传请求已经执行。

共置行为测试覆盖焦点保留、标签 roving、三档网格键盘、不可用与已回应、跨 section 与上传、逐组滚动恢复、三态、预览翻转、侧放、缩放坐标、目录更新与延迟退出。浏览器明暗、四季、减弱动态及独立 tarball 的类型与 SSR 消费由整体验收执行；这些不能由源码或测试文件存在代替。
