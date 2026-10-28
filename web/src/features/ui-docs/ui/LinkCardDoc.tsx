import { ComponentDoc } from "@features/ui-docs/ui/ComponentDoc";
import { LinkCardBasicDemo } from "@features/ui-docs/ui/examples/link-card/basic";
import basicSource from "@features/ui-docs/ui/examples/link-card/basic.tsx?raw";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { MarkdownContent } from "@shared/ui/markdown-preview/MarkdownContent";
import linkCardGuide from "../../../../packages/ui/docs/components/link-card.md?raw";

/** 包内契约与同源示例展示独立链接卡片，不依赖业务数据。 */
export function LinkCardDocPage() {
	return (
		<ComponentDoc componentId="link-card">
			<MarkdownContent content={linkCardGuide} />
			<section aria-label="链接卡片交互示例" className="pb-24">
				<CodeCard code={basicSource} language="tsx" lineNumbers collapseLines={12}>
					<LinkCardBasicDemo />
				</CodeCard>
			</section>
		</ComponentDoc>
	);
}
