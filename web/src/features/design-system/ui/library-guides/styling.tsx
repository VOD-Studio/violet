import { GuideCode, GuideLink, GuideSection } from "./GuideParts";

/** 样式章节：变体优先与工具类边界。 */
export default function StylingGuide() {
	return (
		<GuideSection title="职责顺序">
			<p>
				先通过组件的 <code>variant</code>/<code>size</code> 选择语义，再用{" "}
				<code>className</code> 调整布局；主题级色值放在 CSS
				变量。不要为单个按钮覆写变体色，让同一动作在不同方言下失去含义。
			</p>
			<GuideCode
				code={
					'import { Button } from "@violet/ui";\n\n<Button variant="primary" size="sm" className="w-full">保存</Button>'
				}
			/>
			<p>
				Tailwind v4 间距以 4px 为单位，例如 88px 用 <code>w-22</code>。功能性圆角最大{" "}
				<code>rounded-2xl</code>；浮起只用轻软影或边界描边。具体数值见{" "}
				<GuideLink to="/design-system/layout">布局规格</GuideLink>。
			</p>
		</GuideSection>
	);
}
