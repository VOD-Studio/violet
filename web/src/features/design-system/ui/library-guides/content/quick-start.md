## 环境要求

- React 19 及以上
- react-dom 19 及以上
- Tailwind CSS v4

## 安装

工作区内开发无需安装动作：`web/package.json` 已用 `workspace:*` 声明 `@violet/ui`，装好依赖即可使用。

```bash
cd web
pnpm install
pnpm dev
```

独立项目安装构建产物：先打包 tarball，再在目标项目安装（当前未发布 npm）。

```bash
cd web
pnpm --filter @violet/ui build
pnpm --filter @violet/ui pack --pack-destination /tmp

# 在目标项目根目录
cp /tmp/violet-ui-<version>.tgz .
pnpm add ./violet-ui-<version>.tgz
```

## 导入样式

将以下内容添加到应用的主 CSS 文件：

```css
@import "tailwindcss";
@import "@violet/ui/styles.css";
```

导入顺序很重要：务必先导入 `tailwindcss`。包样式中的 `@theme inline` 映射与 `@source` 组件类名扫描都依赖 Tailwind 先建立编译上下文。

## 使用组件

```tsx
import { Button } from "@violet/ui";
import { useState } from "react";

export function ButtonBasicDemo() {
	const [clicks, setClicks] = useState(0);
	return (
		<div className="flex justify-center">
			<Button type="button" onClick={() => setClicks((count) => count + 1)}>
				已点击 {clicks} 次
			</Button>
		</div>
	);
}
```

```tsx
import { Button } from "@violet/ui";

export function SaveAction() {
	return <Button type="button" onClick={() => console.log("saved")}>保存</Button>;
}
```

按钮执行导航时用 `asChild` 包裹真实链接；纯图标按钮添加 `aria-label`。完整行为与加载态见 [Button 用法页](/design-system/specimens/button)。

## 让 AI 代劳

AI 编码助手可以代劳接入。把文档索引 `https://xunrua.top/llms.txt` 交给支持读取 URL 的助手，或直接发送下面这段提示词：

```text
请为当前项目接入 @violet/ui 组件库。先读取文档索引 https://xunrua.top/llms.txt ，
按其中「快速入门」「主题」「组件目录」章节执行：
1. 在全局 CSS 中先 @import "tailwindcss"，再 @import "@violet/ui/styles.css"；
2. 组件与变体类型从 @violet/ui 根入口导入；
3. 样式定制优先使用 variant / size 与语义工具类，不覆写组件内部实现类；
4. 明暗切换由应用管理 html 的 dark 类。
```

## 下一步

- [主题](/design-system/guides/theming)——通过 CSS 变量定制色板与语义 token。
- [浏览组件](/design-system/specimens)——查看所有可用组件的用法与限制。
- [学习样式](/design-system/guides/styling)——用变体与 Tailwind 工具类自定义外观。
- [探索组合模式](/design-system/guides/composition)——掌握 asChild 与复合部件。
