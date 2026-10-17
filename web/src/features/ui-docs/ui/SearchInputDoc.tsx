import { ComponentDoc } from "@features/ui-docs/ui/ComponentDoc";
import { SearchInputBasicDemo } from "@features/ui-docs/ui/examples/search-input/basic";
import basicSource from "@features/ui-docs/ui/examples/search-input/basic.tsx?raw";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { MarkdownContent } from "@shared/ui/markdown-preview/MarkdownContent";
import searchInputGuide from "../../../../packages/ui/docs/components/search-input.md?raw";

/** 搜索行为与 Input 外观共用，文档正文读取包内契约。 */
export function SearchInputDocPage() {
	return (
		<ComponentDoc componentId="search-input">
			<MarkdownContent content={searchInputGuide} />
			<section aria-label="搜索交互示例" className="pb-24">
				<CodeCard code={basicSource} language="tsx" lineNumbers collapseLines={10}>
					<SearchInputBasicDemo />
				</CodeCard>
			</section>
		</ComponentDoc>
	);
}
