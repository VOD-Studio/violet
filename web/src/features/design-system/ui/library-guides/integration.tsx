import { GuideCode, GuideLink, GuideSection } from "./GuideParts";
import { GuidePending } from "./GuidePending";

/** 框架集成章节：Vite 与 TanStack Start 实证，其余框架暂未开放。 */
export default function IntegrationGuide() {
	return (
		<>
			<GuideSection title="Vite（已验证）">
				<p>
					在 Vite 项目的全局 CSS 先后导入 Tailwind 与包样式，即可使用全部组件；
					以下路径在仓库外的独立 React 19 + Vite 8 项目实测通过。
				</p>
				<GuideCode
					language="ts"
					title="vite.config.ts"
					code={
						'import tailwindcss from "@tailwindcss/vite";\nimport react from "@vitejs/plugin-react";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({ plugins: [tailwindcss(), react()] });'
					}
				/>
				<GuideCode
					language="css"
					title="src/styles.css"
					code={'@import "tailwindcss";\n@import "@violet/ui/styles.css";'}
				/>
			</GuideSection>
			<GuideSection title="TanStack Start（已验证）">
				<p>
					本站即宿主：通过 <code>workspace:*</code> 消费包，SSR
					页面在根布局加载同一份全局样式，让首屏与客户端拿到同一套变量；把{" "}
					<code>.dark</code> 挂在 html 或共同祖先，主题持久化由应用负责，见{" "}
					<GuideLink to="/design-system/guides/dark-mode">深色模式</GuideLink>。
				</p>
				<GuideCode
					language="bash"
					title="安装（工作区）"
					code="cd web\npnpm install\npnpm dev"
				/>
			</GuideSection>
			<GuideSection title="更多框架">
				<p>以下宿主尚未验证或暂无计划，先列出方向；开放后在此补充实测步骤。</p>
				<div className="grid gap-3 sm:grid-cols-2">
					<GuidePending title="Next.js（App Router）">SSR 布局导入验证中</GuidePending>
					<GuidePending title="Remix">暂未开放</GuidePending>
					<GuidePending title="Astro">暂未开放</GuidePending>
					<GuidePending title="Storybook">暂未开放</GuidePending>
				</div>
				<p>没有 Vue/Svelte 原生组件；构建产物面向 React 19 宿主。</p>
			</GuideSection>
		</>
	);
}
