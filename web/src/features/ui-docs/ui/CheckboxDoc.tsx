import { AnchoredHeading } from "@shared/ui/anchored-heading";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { MarkdownContent } from "@shared/ui/markdown-preview/MarkdownContent";
import guideSource from "../../../../packages/ui/docs/components/checkbox.md?raw";
import { ComponentDoc } from "./ComponentDoc";
import { CheckboxBasicDemo } from "./examples/checkbox/basic";
import basicSource from "./examples/checkbox/basic.tsx?raw";
import { CheckboxDisabledDemo } from "./examples/checkbox/disabled";
import disabledSource from "./examples/checkbox/disabled.tsx?raw";
import { CheckboxFormDemo } from "./examples/checkbox/form";
import formSource from "./examples/checkbox/form.tsx?raw";
import { CheckboxSizesDemo } from "./examples/checkbox/sizes";
import sizesSource from "./examples/checkbox/sizes.tsx?raw";
import { CheckboxTriStateDemo } from "./examples/checkbox/tri-state";
import triStateSource from "./examples/checkbox/tri-state.tsx?raw";
import { CheckboxVariantsDemo } from "./examples/checkbox/variants";
import variantsSource from "./examples/checkbox/variants.tsx?raw";

const EXAMPLES = [
	{ id: "checkbox-basic", title: "标签与受控值", source: basicSource, Demo: CheckboxBasicDemo },
	{
		id: "checkbox-tri-state",
		title: "全选与半选",
		source: triStateSource,
		Demo: CheckboxTriStateDemo,
	},
	{ id: "checkbox-form", title: "表单提交与重置", source: formSource, Demo: CheckboxFormDemo },
	{
		id: "checkbox-variants",
		title: "可替换的语义色",
		source: variantsSource,
		Demo: CheckboxVariantsDemo,
	},
	{ id: "checkbox-sizes", title: "盒面尺寸", source: sizesSource, Demo: CheckboxSizesDemo },
	{
		id: "checkbox-disabled",
		title: "禁用状态",
		source: disabledSource,
		Demo: CheckboxDisabledDemo,
	},
];

/** 包内契约正文与同源 Checkbox integration 示例。 */
export function CheckboxDocPage() {
	return (
		<ComponentDoc componentId="checkbox">
			<MarkdownContent content={guideSource} />
			<section className="space-y-12">
				<AnchoredHeading
					as="h2"
					id="checkbox-examples"
					className="text-xl font-semibold text-foreground"
				>
					运行示例
				</AnchoredHeading>
				{EXAMPLES.map(({ id, title, source, Demo }) => (
					<div key={id} className="space-y-3">
						<AnchoredHeading
							as="h3"
							id={id}
							className="text-lg font-semibold text-foreground"
						>
							{title}
						</AnchoredHeading>
						<CodeCard code={source} language="tsx" lineNumbers collapseLines={8}>
							<Demo />
						</CodeCard>
					</div>
				))}
			</section>
		</ComponentDoc>
	);
}
