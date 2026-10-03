## 准备环境

React 组件要求 React 19 与 react-dom 19。使用完整 `styles.css` 的宿主需要 Tailwind CSS v4；只使用 `tokens.css` 与组件 CSS 时不需要 Tailwind。

工作区内 `web/package.json` 已声明 `workspace:*`：

```bash
cd web
pnpm install
pnpm dev
```

## 在独立项目安装

当前尚未发布 npm。先从 violet 的 `web` 目录构建并打包，再安装实际生成的 tgz：

```bash
pnpm --filter @violet/ui build
pnpm --filter @violet/ui pack --pack-destination /tmp

# 在目标项目目录，路径以 pack 输出为准
pnpm add /tmp/violet-ui-0.1.0.tgz
```

源码入口与发布入口分别定义。独立消费者验收命令为 `pnpm --filter @violet/ui consumer`，步骤见[组件设计方法](/design-system/guides/component-design)。

## 导入样式

Tailwind 宿主的全局 CSS：

```css
@import "tailwindcss";
@import "@violet/ui/styles.css";
```

完整样式带语义变量、默认色板、Tailwind 映射与组件 CSS。基础组件的外观已编译为 BEM 规则；legacy recipe 仍由兼容扫描补充，消费方无需复制 token 或手写包源码扫描配置。

只取基础组件外观时：

```css
@import "@violet/ui/tokens.css";
@import "@violet/ui/components/button.css";
@import "@violet/ui/components/input.css";
@import "@violet/ui/components/label.css";
@import "@violet/ui/components/text-field.css";
```

也可用 `classes.css` 加载全部预编译规则。CSS 不提供组件行为；纯 HTML 的 button 与 input 保留原生行为，复杂浮层使用 React / Radix 组件。

## 运行第一个表单

```tsx
import { Button, TextField } from "@violet/ui";
import { useState } from "react";

export function ProfileForm() {
  const [name, setName] = useState("");
  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <TextField
        label="显示名称"
        name="displayName"
        value={name}
        onChange={(event) => setName(event.target.value)}
        description="用于评论署名"
        required
      />
      <Button type="submit">保存</Button>
    </form>
  );
}
```

Button 默认 `type="button"`；提交操作显式指定 `submit`。TextField 不内置校验规则，`onChange` 接收原生事件，ref 指向 input。组件与类型通常从根入口导入；按单元取用可用 `@violet/ui/button` 与 `@violet/ui/text-field`。

## 确认使用范围

本批次的 foundation 单元是 Button、Input、Label、Textarea、TextField，其他单元为 legacy。用前查看[重建进度](/design-system/guides/roadmap)与对应[组件用法](/design-system/specimens)。主题由宿主管理，深色切换见[深色模式](/design-system/guides/dark-mode)。

编码助手可以从[文档索引](https://xunrua.top/llms.txt)读取指南；在仓库内也可直接读 `component-manifest.json`、同源示例与 `violet-ui` skill。新组件的结构和验收流程见[组件库架构](/design-system/guides/architecture)与[组件设计方法](/design-system/guides/component-design)。
