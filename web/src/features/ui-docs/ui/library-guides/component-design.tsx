import guideSource from "../../../../../packages/ui/docs/component-design.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

export default function ComponentDesignGuide() {
	return (
		<MarkdownGuideDoc
			source={guideSource
				.replaceAll("(./architecture.md)", "(/ui/guides/architecture)")
				.replaceAll("(./component-design.md)", "(/ui/guides/component-design)")}
		/>
	);
}
