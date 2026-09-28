import { GuideCode, GuideSection } from "./GuideParts";

/** 主题章节：包的主题入口与站点方言。 */
export default function ThemingGuide() {
	return (
		<>
			<GuideSection title="包的主题入口">
				<p>
					<code>@violet/ui/styles.css</code> 包含语义 token、Tailwind{" "}
					<code>@theme inline</code> 映射与默认 Violet 色板；应用必须先导入 Tailwind v4。
					<code>@theme inline</code>{" "}
					让工具类在所在作用域读取当前变量，而非将颜色固化在根元素。
				</p>
				<GuideCode
					language="css"
					code={
						'@import "tailwindcss";\n@import "@violet/ui/styles.css";\n\n/* 在包样式之后覆盖主色源，不覆盖行为状态色 */\n:root { --primary-base: oklch(0.53 0.205 286); }\n.dark { --primary-base: oklch(0.72 0.148 286); }'
					}
				/>
			</GuideSection>
			<GuideSection title="站点方言">
				<p>
					组件库只提供默认值。本站的 <code>dialect-public</code> 将主要动作映射到主色源，
					<code>dialect-tool</code> 保留中性主要动作；它们是 web
					应用的样式，不随库发布。消费方可以在自己的 CSS
					作用域覆盖同名语义变量。覆盖后检查文字对比度，尤其是{" "}
					<code>--primary-base-foreground</code>。
				</p>
			</GuideSection>
		</>
	);
}
