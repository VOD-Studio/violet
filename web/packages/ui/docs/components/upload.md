# UploadQueue、UploadDropzone 与 UploadTile

`upload` 单元提供纯展示的 `UploadQueue` 和原生选择入口 `UploadDropzone`；`upload-tile` 单元提供方形原生入口。它们不访问 File、上传 API、会话、路由、素材库或通知。宿主持有真实队列、并发策略、拖放与文件选择。

```tsx
import { UploadDropzone, UploadQueue, type UploadEntry } from "@violet/ui";

export function UploadPanel({ items, selectFiles, cancel, retry }: {
  items: readonly UploadEntry[];
  selectFiles: () => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
}) {
  return <>
    <UploadDropzone onClick={selectFiles} hint="支持图片、视频、音频和文件">
      点击选择文件，或拖到这里
    </UploadDropzone>
    <UploadQueue items={items} concurrency={3} onCancel={cancel} onRetry={retry} />
  </>;
}
```

组件可从根入口或 `@violet/ui/upload`、`@violet/ui/upload-tile` 取用。普通 CSS 宿主先加载 `tokens.css`，再加载 `components/upload.css` 或 `components/upload-tile.css`；叶子 CSS 包含指示器依赖，不要求宿主猜测组合依赖。派生入口由清单同步生成。

## 数据与状态

`UploadEntry` 包含 `id`、完整 `name`、字节 `size`、`status`、0–100 的 `progress`；可选 `thumbnail`、`kind`（image/video/audio/file）、`error`、毫秒时间戳 `retryAt`、`cancelling`、`description`。

| 状态 | 显示与动作 |
| --- | --- |
| queued | 排队；小号季节描线梅枝；可取消 |
| uploading | 实际上传百分比和字节数；2px 进度条；可取消 |
| waiting | 等待；有 retryAt 时显示自动继续倒计时；梅枝；可取消 |
| done | 服务端报告完成后显示对勾；进度条淡去；可移除 |
| error | 危险色错误、已传百分比；可重试和取消；冷却期间原生禁用重试 |
| cancelled | 宿主确认取消后才显示已取消；可移除 |

`cancelling` 覆盖状态文案为「正在确认取消」，禁用该项重试/取消，不篡改原始 `data-state`。百分比 100 的 uploading 仍然是上传中，取消竞争最后得到 done 时保留真实成功。`description` 可提供校验、续传或服务端完成描述；组件不推断不存在的数据。等待项没有 retryAt 时不编造自动恢复时间。

`policy` 为 ready/loading/error/paused，loading 显示配置加载，error 提供 `onRetryPolicy`，paused 提供 `onResume`。在途文件不会因为策略暂停而被改画为排队。`concurrency` 只显示上限，不调度请求。

面板环按非 cancelled 项的文件大小加权；done 算全部字节，其余只算实际百分比。错误项保留已上传字节，cancelled 不充当成功或 100%。总字节为零时显示 0%。`now` 是毫秒时钟；省略时首帧不读取本机时间，有重试期限的按钮先保持禁用，水合后再更新倒计时。没有期限时不启动时钟，冷却结束或卸载后清理；组件不自动调用 retry。SSR 宿主若要首帧显示具体秒数，须向服务端与客户端传入同一份 `now`。

## 动作与可访问性

- 原生 section/ref/className/style/事件透传；有可见标题命名，宿主 aria-label/aria-labelledby 优先。
- 文件为原生列表；完成/等待/上传为 status，错误和策略失败为 alert。图形对读屏隐藏；总环为命名 progressbar。每个原生操作按钮含完整文件名。
- `onCancel`、`onCancelAll` 只是请求宿主取消；宿主必须先报告 cancelling，等服务端确认后再报告 cancelled 或 done。组件不乐观丢弃成功。
- `onClose` 请求宿主关闭。未完成项须由宿主确认、取消并等待结果；组件不会自行删除数据或卸载。收起永不取消。
- 原生 `onClickCapture` 可用 `preventDefault()` 取消队列按钮的激活；取消后不收起、不移动焦点，也不调用上传动作。
- `onRemove` 仅用于 done/cancelled；`onClearCompleted` 只清除已结束项。移除前焦点转到邻项操作或收起按钮；清空前回到收起按钮。
- 收起是组件唯一面板状态，`defaultCollapsed` 仅控制初值。200ms grid 折叠期间整个正文 inert/aria-hidden；展开恢复原有数据。正文裁切层与滚动列表保留至少 4px 焦点空间。
- 不随进度/队列更新自动滚动或抢焦点。只有列表内操作获得焦点时，局部调整列表滚动使所在行可见，不滚动宿主文档。

## 外观边界

面板默认内联宽 360、最大不超过宿主；`floating` 固定视口右下 16，窄屏宽度不超过视口减 32。圆角 16、纸面底色、只使用 shadow-soft；标题高 56，列表最大 280，条目高 52、圆角 10、横向内边距 10；缩略图 32、圆角 6。文件名 13、大小 11 mono、状态 12；文件名拆分末段扩展名，主名截断时扩展名仍保留，完整名称在 title 与操作名称中。条目无卡片背景、边框、分隔线，只在悬停时浅底。

上传条以左侧为原点 scaleX，200ms linear；错误危险色、完成淡去。waiting/queued 使用季节描线梅枝而非伪上传条。减弱动态在 queue/dropzone/tile 内停用所有动画与过渡，包括子指示器，保留静态梅枝；不修改全局 Indicator 行为。

`UploadTile` 默认 8px 圆角、浅凹底、20px 加号，无虚线；大宿主可覆盖 `--v-upload-tile-radius: 12px`。`dragActive` 显示浅季节底与上传箭头，busy 优先显示 spinner 并禁止激活；disabled 保留原生禁用。尺寸由父容器决定。`UploadDropzone` 的 `children` 是选择标签，`hint` 是提示，`dragActive` 仅控制视觉；原生 ref、disabled、type 与可取消提交行为不变，默认 type=button。

以上是组件契约，不代表已完成浏览器、季节、窄屏、减弱动态或 tarball 验收；证据由集成验证记录。
