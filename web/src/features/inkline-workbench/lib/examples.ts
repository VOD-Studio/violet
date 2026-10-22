import animationSource from "../../../../packages/inkline/examples/animation.ts?raw";
import fillsSource from "../../../../packages/inkline/examples/fills.ts?raw";
import handsSource from "../../../../packages/inkline/examples/hands.ts?raw";
import lineWashSource from "../../../../packages/inkline/examples/line-wash.ts?raw";
import mermaidExampleSource from "../../../../packages/inkline/examples/mermaid.ts?raw";
import pensSource from "../../../../packages/inkline/examples/pens.ts?raw";
import quickStartSource from "../../../../packages/inkline/examples/quick-start.ts?raw";

/** README 展示的那段代码：有 `#region readme` 时只取区域内，规则同包内 sync-readme 脚本。 */
export function readmeRegion(source: string): string {
	const region = source.match(/\/\/ #region readme\n([\s\S]*?)\n\/\/ #endregion/);
	return (region ? region[1] : source).trimEnd();
}

/** Mermaid 样例里的图表源码，演示页用站点的图块管线渲染同一张图。 */
export function mermaidDiagram(source: string): string {
	const match = source.match(/const source = `([\s\S]*?)`;/);
	if (!match) throw new Error("examples/mermaid.ts no longer defines `const source`.");
	return match[1];
}

/** 各节代码面板展示的源码，与包 README 的样例同源。 */
export const EXAMPLE_CODE = {
	animation: readmeRegion(animationSource),
	quickStart: readmeRegion(quickStartSource),
	pens: readmeRegion(pensSource),
	hands: readmeRegion(handsSource),
	fills: readmeRegion(fillsSource),
	lineWash: readmeRegion(lineWashSource),
	mermaid: readmeRegion(mermaidExampleSource),
} as const;

export const MERMAID_DIAGRAM = mermaidDiagram(mermaidExampleSource);
