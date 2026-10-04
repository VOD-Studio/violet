## 基础单元的反馈

新 Button 通过颜色、描边与透明度反馈状态，loading 使用静态占位与指示器，避免 scale、方向性位移或 grid 尺寸补间。CSS 负责 `prefers-reduced-motion` 降级。

包内仍有 legacy 组件与既有动画，不能把基础单元的约束描述为全库已经统一。通用主题保留以下真实控件使用的动画：

| 名称 | 用途 | 归属 |
| --- | --- | --- |
| `caret-blink` | OTP 插字符 | 组件库 |
| `nexus-shimmer` | Skeleton 指示加载 | 组件库 |
| `tab-panel-in` | 仅透明度淡入 | 组件库 |
| `blob`、`diagram-enter`、`marquee` | 站点装饰或内容展示 | `web/src/styles/site-theme.css` |

站点字体与装饰动画由宿主加载，通用 CSS 不要求 Maple 字体或手写签名资源。

## 普通状态保持克制

常规 hover、选中、打开与关闭通过颜色、描边、软影和透明度表达。只有图片预览、画布缩放等交互本身表达缩放时才用 scale；只有明确空间来源或去向时才用方向性运动。组件自身的反馈契约见[组件设计方法](/ui/guides/component-design)。

```tsx
import { Button } from "@violet/ui";

<Button className="transition-opacity hover:opacity-85 motion-reduce:transition-none">
  保存
</Button>
```

调用方添加动画时也承担减弱动态。CSS 使用 `motion-reduce:transition-none` / `motion-reduce:animate-none`；JS 动画库需要读取偏好，组件 CSS 无法替它停下弹簧或循环。

## 校验实际状态

在浏览器切换减弱动态，检查加载与结束、聚焦与失焦、打开与关闭；指示内容仍须可识别。避免常驻 `will-change`，也不要为普通按钮反馈引入布局动画。动画状态与可访问状态分别检查，视觉淡出不能代替 disabled 或事件拦截。
