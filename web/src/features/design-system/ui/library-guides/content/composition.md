## 保留元素语义

`Button asChild` 使用 Radix Slot 将外观传给唯一子元素。导航仍是链接，提交仍是原生按钮。不要把按钮外观等同于按钮行为。

```tsx
import { Button } from "@violet/ui";
import { Link } from "@tanstack/react-router";

<Button asChild variant="outline">
  <Link to="/design-system/specimens">查看组件</Link>
</Button>
```

## 按部件组合

Dialog 和 Tabs 导出可组合的根、触发器、内容部件。组合必须保留标题、焦点和键盘行为；完整用法看 [Dialog](/design-system/specimens/dialog) 与 [Tabs](/design-system/specimens/tabs) 的示例。

## 多态样式

带变体的组件把样式函数从包根导出：`buttonVariants`、`badgeVariants`、`checkboxVariants`、`tabsListVariants`。给任意元素拼同一套外观，不必渲染组件本体：

```tsx
import { buttonVariants } from "@violet/ui";

<a href="/design-system" className={buttonVariants({ variant: "outline" })}>
	组件文档
</a>
```

## 与框架无关的样式

变体函数基于 tailwind-variants，是返回类名字符串的普通函数：传参、拼类名、输出，不经过组件挂载，服务端渲染与测试里同样可用。参数与组件的 `variant` / `size` props 一致。

不用 React 的页面改用预编译类名：`@violet/ui/classes.css` 提供 `.v-button` 等 BEM 类，配合 `tokens.css` 使用，纯 HTML 示例见[框架集成](/design-system/guides/integration)。
