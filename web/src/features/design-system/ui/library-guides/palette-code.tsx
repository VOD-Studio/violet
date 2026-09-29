import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { markdownComponents } from "@shared/ui/markdown-preview/components/markdown-components";
import type { Components } from "react-markdown";
import coralPaletteSource from "../../../../../packages/ui/src/styles/palettes/coral.css?raw";
import violetPaletteSource from "../../../../../packages/ui/src/styles/palettes/violet.css?raw";
import { ColorUsageDemo } from "../examples/color/usage";
import usageSource from "../examples/color/usage.tsx?raw";

// 裁掉文件头注释只展示变量声明区；找不到标记时整文件展示，避免 slice(-1) 静默错位
const sliceFromMarker = (source: string, marker: string): string => {
	const at = source.indexOf(marker);
	return at === -1 ? source : source.slice(at);
};
const VIOLET_PALETTE_CSS = sliceFromMarker(violetPaletteSource, ":root {");
const CORAL_PALETTE_CSS = sliceFromMarker(coralPaletteSource, ":root");

const EXAMPLE_TITLES: Record<string, string> = {
	"language-palette-css": "应用样式示例",
	"language-palette-entry": "应用入口与可选的局部语义映射",
	"language-palette-notice": "应用自有颜色 · src/styles/notice.css",
};

const DefaultCode = markdownComponents.code ?? "code";

/** 文档中的专用围栏从真实示例或包内源码取值，不复制色板定义。 */
export const paletteCodeRenderer: NonNullable<Components["code"]> = (props) => {
	const { className, children } = props;
	if (className === "language-palette-demo") {
		return (
			<CodeCard className="my-6" code={usageSource} language="tsx" title="组件与工具类">
				<ColorUsageDemo />
			</CodeCard>
		);
	}
	if (className === "language-palette-violet" || className === "language-palette-coral") {
		return (
			<CodeCard
				className="my-6"
				code={
					className === "language-palette-violet" ? VIOLET_PALETTE_CSS : CORAL_PALETTE_CSS
				}
				language="css"
				title={
					className === "language-palette-violet"
						? "包内源码 · 默认 violet.css"
						: "包内源码 · palettes/coral.css"
				}
			/>
		);
	}
	const title = className ? EXAMPLE_TITLES[className] : undefined;
	if (title) {
		return (
			<CodeCard
				className="my-6"
				code={String(children).replace(/\n$/, "")}
				language="css"
				title={title}
			/>
		);
	}
	return <DefaultCode className={className}>{children}</DefaultCode>;
};
