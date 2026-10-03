import guideSource from "../../../../../packages/ui/docs/architecture.md?raw";
import { MarkdownGuideDoc } from "./markdown-guide";

export default function ArchitectureGuide() {
	return (
		<MarkdownGuideDoc
			source={guideSource
				.replaceAll("(./architecture.md)", "(/ui/guides/architecture)")
				.replaceAll("(./component-design.md)", "(/ui/guides/component-design)")}
		/>
	);
}
