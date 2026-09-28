import { GuideCode, GuideLink, GuideSection } from "./GuideParts";

/** 组合章节：asChild 与组合式部件。 */
export default function CompositionGuide() {
	return (
		<>
			<GuideSection title="保留元素语义">
				<p>
					<code>Button asChild</code> 使用 Radix Slot
					将外观传给唯一子元素。导航仍是链接，提交仍是原生按钮。不要把按钮外观等同于按钮行为。
				</p>
				<GuideCode
					code={
						'import { Button } from "@violet/ui";\nimport { Link } from "@tanstack/react-router";\n\n<Button asChild variant="outline">\n  <Link to="/design-system/specimens">查看组件</Link>\n</Button>'
					}
				/>
			</GuideSection>
			<GuideSection title="按部件组合">
				<p>
					Dialog 和 Tabs
					导出可组合的根、触发器、内容部件。组合必须保留标题、焦点和键盘行为；完整用法看{" "}
					<GuideLink to="/design-system/specimens/dialog">Dialog</GuideLink> 与{" "}
					<GuideLink to="/design-system/specimens/tabs">Tabs</GuideLink> 的示例。
				</p>
			</GuideSection>
		</>
	);
}
