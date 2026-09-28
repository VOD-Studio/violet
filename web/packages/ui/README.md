# @violet/ui

React 19 + Tailwind CSS v4 组件库，附 Violet 明暗语义主题 token。

## 安装

仓库内：`web/package.json` 以 `workspace:*` 声明本包。

仓库外（未发布 npm）：在 violet 仓库 `web` 目录执行 `pnpm --filter @violet/ui build && pnpm --filter @violet/ui pack --pack-destination /tmp`，再把 tarball 安装到目标项目（`pnpm add /tmp/violet-ui-<version>.tgz`）。

宿主要求：React 19、react-dom 19、Tailwind CSS v4。

## 接入样式

在应用全局 CSS 中，先导入 Tailwind，再导入本包样式：

```css
@import "tailwindcss";
@import "@violet/ui/styles.css";
```

包内 CSS 携带 `@source` 指令，宿主 Tailwind 会扫描打包后的组件类名；深色模式由宿主在根元素挂 `.dark` 类驱动。

## 使用组件

```tsx
import { Button } from "@violet/ui";

export function SaveAction() {
	return <Button type="button">保存</Button>;
}
```

组件用法与在线示例见营造法式：https://xunrua.top/design-system

## 从源码构建

```bash
pnpm --filter @violet/ui build   # 产出 dist/：ESM、类型声明、主题 CSS
pnpm --filter @violet/ui pack    # 生成可安装的 tarball
```

MIT License。
