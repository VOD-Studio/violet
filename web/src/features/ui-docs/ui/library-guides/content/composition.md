## 以原生语义作为组合边界

提交用 button，导航用链接。`Button asChild` 使用 Radix Slot 把样式、属性与 ref 交给唯一子元素：

```tsx
import { Button } from "@violet/ui";
import { Link } from "@tanstack/react-router";

<Button asChild variant="outline">
  <Link to="/ui/components">查看组件</Link>
</Button>
```

禁用或忙碌时，Button 阻止子元素的交互 handler；自定义链接必须透传属性与 ref。`asChild` 保留子元素内容，不插入 `leftIcon`、`rightIcon` 或 `loadingText`。需要这些内容时由子元素自己提供。

## 组合字段保留 input 契约

TextField 的值、原生事件和 ref 仍属于 input：

```tsx
import { TextField } from "@violet/ui";
import { useState } from "react";

export function NameField() {
  const [name, setName] = useState("");
  return (
    <TextField
      label="显示名称"
      value={name}
      onChange={(event) => setName(event.target.value)}
      description="公开显示在评论旁"
      classNames={{ root: "max-w-sm" }}
    />
  );
}
```

ID 未指定时由 `useId` 生成。label、description 与实际显示的 error 关联到同一 input。`className` 属于 input，外层布局使用 `classNames.root`。完整示例见[TextField](/ui/components/text-field)。

多行输入使用 Label 与 Textarea，手动保持关联：

```tsx
import { Label, Textarea } from "@violet/ui";
import { useId } from "react";

export function BiographyField() {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>简介</Label>
      <Textarea id={id} name="biography" rows={4} />
    </div>
  );
}
```

## 只取用样式 recipe

需要同一外观而已时，从纯 recipe 入口计算类名：

```tsx
import { buttonVariants } from "@violet/ui/variants";

<a href="/ui" className={buttonVariants({ variant: "outline" })}>
  组件文档
</a>
```

它输出类名，不接管 disabled、loading、键盘或 ref；这些行为由实际元素与消费方负责。纯 HTML 直接使用同名 BEM 类，加载方式见[样式](/ui/guides/styling)。

## legacy 复合部件

Dialog、Tabs 等继续保留可组合的根、触发器与内容部件，目前状态为 legacy。使用时保留标题、焦点和键盘语义；具体契约见 [Dialog](/ui/components/dialog) 与 [Tabs](/ui/components/tabs)。这些组件的目录已统一，行为和样式仍需按单元迁移。
