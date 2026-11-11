# Sortable 拖拽排序

用于顺序本身有意义的纵向列表。调用方持有数据、内容与持久化；每项必须有稳定标识和能被读屏读出的名称，不以数组下标作标识。

```tsx
import { Sortable } from "@violet/ui";

<Sortable
  aria-label="章节顺序"
  items={chapters}
  getId={(chapter) => chapter.id}
  getLabel={(chapter) => chapter.title}
  onReorder={setChapters}
  renderItem={(chapter) => <span>{chapter.title}</span>}
/>;
```

- 行最小高度 48px、间隔 4px、圆角 12px；内容是编辑表单时允许自然增高。把手热区 32px，指针进入或键盘聚焦时出现；触屏常显。
- 拿起后原位置保留凹陷槽，移动行只使用纸片底与软影，不缩放、不旋转。其余行 200ms 让位，落位 160ms 后调用 `onReorder`；减弱动态下立即提交。
- 把手上空格或 Enter 拿起；↑↓ 移动；空格或 Enter 放下；Esc 取消。原生 `ol` / `li` 保留顺序语义，每步由 live region 播报；行右侧菜单也提供上移和下移，边界项不可越界。
- `onReorder` 可以返回 Promise；持久化失败时拒绝 Promise，组件恢复原位并播报失败，业务端负责错误提示。调用成功后须更新受控 `items`。
- 落位等待期间按稳定标识从最新 `items` 取项目，保留在同一时间修改的表单值、新加入的项目及已移除状态。`disabled` 阻止拖拽和移动菜单，不会禁用调用方内容里的其他控件。
