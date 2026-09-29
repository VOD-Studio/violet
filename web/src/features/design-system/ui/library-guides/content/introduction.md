## violet 的组件库

`@violet/ui` 是基于 React 19、Tailwind CSS v4 与 Radix UI 的组件库，附明暗一体的语义主题 token。营造法式是它的在线用法与设计规范，不是另一套组件实现。

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

## 组件库，而不是复制粘贴

把文档里的按钮、对话框样式片段复制进项目，短期最快，长期会留下三个缺口：焦点管理、键盘导航、`aria` 语义等无障碍行为需要逐个补齐；主题调整要改散落各处的副本；上游修复缺陷时，副本不会跟着更新。

组件库把结构、行为与主题收进一个带版本的依赖入口：升级一次依赖，所有使用点同步受益。`@violet/ui` 以包形式消费——仓库内 `workspace:*`，仓库外经 tarball 安装——配合 ESM tree-shaking，未用到的组件不会进入产物。

## 核心特性

- **默认即成体系**：语义 token 与 Violet 色板开箱可用，明暗主题同一套类名。
- **无障碍基座**：交互件构建在 Radix UI 之上，焦点管理、键盘导航与屏幕阅读器语义内建。
- **组合式部件**：Dialog、Tabs 等以根、触发器、内容部件导出，按需组合不锁死结构。
- **完整类型化**：根入口导出全部组件与变体类型，IDE 补全可用。
- **宿主解耦**：不绑定路由与主题库，由应用自带并桥接。
- **按需打包**：JS 侧 ESM tree-shaking，样式侧按粒度拆分入口（`styles.css` / `tokens.css` / 色板子导出），不用的部分不进产物。

## 生态

- [快速入门](/design-system/guides/quick-start)：安装、导入样式与第一个组件。
- [组件目录](/design-system/specimens)：逐组件的用法、示例与限制。
- [Token 词典](/design-system/tokens)与[颜色](/design-system/palette)：语义变量名与实时值。
- `https://xunrua.top/llms.txt`：供 AI 编码助手读取的文档索引，用法见快速入门的「让 AI 代劳」。

## 常见问题

- **免费吗？什么协议？**MIT 协议，可免费用于商业项目。
- **生产可用吗？**可用，营造法式站点本身就用这套组件构建。npm 公开发布尚未执行，仓库外经 tarball 安装，见[快速入门](/design-system/guides/quick-start)。
- **支持 TypeScript 吗？**完全类型化，类型声明随构建产物提供。
- **怎么定制样式？**优先用变体与语义类，主题值通过覆盖 CSS 变量调整，见[主题](/design-system/guides/theming)与[样式](/design-system/guides/styling)。
- **不用 React，只用样式可以吗？**可以。`@violet/ui/tokens.css` 提供纯 CSS 变量层，`@violet/ui/classes.css` 提供带 `v-` 前缀的预编译组件类，两者都不依赖 React。
- **有 Figma 设计源吗？**暂无。色板与 token 以 CSS 变量为唯一事实源，实时值可在[颜色](/design-system/palette)查看。

## 下一步

从[快速入门](/design-system/guides/quick-start)跑起第一个组件，或到[组件目录](/design-system/specimens)逐个查看用法、示例与限制。
