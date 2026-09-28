import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { ApiTable, type ApiTableColumn } from "./ApiTable";
import { BadgeCounterDemo } from "./examples/badge/counter";
import counterSource from "./examples/badge/counter.tsx?raw";
import { BadgeDotDemo } from "./examples/badge/dot";
import dotSource from "./examples/badge/dot.tsx?raw";
import { BadgeVariantsDemo } from "./examples/badge/variants";
import variantsSource from "./examples/badge/variants.tsx?raw";

interface PropRow {
	name: string;
	type: string;
	defaultValue: string;
	meaning: string;
}

const BADGE_PROPS: PropRow[] = [
	{
		name: "variant",
		type: '"default" | "secondary" | "destructive" | "outline" | "ghost" | "link"',
		defaultValue: '"default"',
		meaning: "语义色、透明与链接外观；link 仅提供样式，导航语义由外层 Link 承担。",
	},
	{
		name: "size",
		type: '"default" | "count" | "dot"',
		defaultValue: '"default"',
		meaning: "标签、数量胶囊（至少 16px）或 10px 状态点；数量显示文案由调用方传入。",
	},
];

const ANCHOR_PROPS: PropRow[] = [
	{
		name: "badge",
		type: "ReactNode",
		defaultValue: "—",
		meaning: "角标内容；null 时不渲染角标。角标仅作视觉提示，不接收指针事件。",
	},
	{
		name: "placement",
		type: '"corner" | "edge"',
		defaultValue: '"corner"',
		meaning: "数量胶囊外置；小圆点使用 edge 贴住按钮圆弧。",
	},
];

const PROP_COLUMNS: ApiTableColumn<PropRow>[] = [
	{
		label: "属性",
		headerClassName: "min-w-28",
		cellClassName: "font-mono text-foreground",
		render: (row) => row.name,
	},
	{
		label: "类型",
		headerClassName: "min-w-56",
		cellClassName: "font-mono text-muted-foreground",
		render: (row) => row.type,
	},
	{ label: "默认值", headerClassName: "min-w-28", render: (row) => row.defaultValue },
	{
		label: "说明与约束",
		headerClassName: "min-w-56",
		cellClassName: "text-muted-foreground leading-relaxed",
		render: (row) => row.meaning,
	},
];

/** 展示 Badge 标签与 BadgeAnchor 角标的真实用法。 */
export function BadgeDocPage() {
	return (
		<article className="mx-auto w-full max-w-4xl space-y-14 pb-24 font-sans">
			<header className="space-y-3">
				<h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
					Badge 徽章与角标
				</h1>
				<p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
					标签表达简短状态；角标附着在触发器右上角，表示数量或新消息。Badge
					只负责展示，不读取数据；调用方决定数量、文案与是否显示。
				</p>
				<p className="text-xs text-muted-foreground">
					源码{" "}
					<code className="font-mono text-foreground">
						web/packages/ui/src/badge/badge.tsx
					</code>
				</p>
			</header>

			<section aria-labelledby="badge-variants" className="space-y-4">
				<h2 id="badge-variants" className="text-xl font-bold text-foreground">
					标签颜色
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					主色、次要、警示、描边、透明与链接外观。Link 负责跳转，Badge 不代替链接。
				</p>
				<CodeCard code={variantsSource} language="tsx" lineNumbers collapseLines={6}>
					<BadgeVariantsDemo />
				</CodeCard>
			</section>

			<section aria-labelledby="badge-counter" className="space-y-4">
				<h2 id="badge-counter" className="text-xl font-bold text-foreground">
					数量角标
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					点击调整数量。超过 99 显示 99+、为零时隐藏角标：两者均由调用方计算。
				</p>
				<CodeCard code={counterSource} language="tsx" lineNumbers collapseLines={6}>
					<BadgeCounterDemo />
				</CodeCard>
			</section>

			<section aria-labelledby="badge-dot" className="space-y-4">
				<h2 id="badge-dot" className="text-xl font-bold text-foreground">
					状态点
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					只需提示存在新消息、不需显示数量时使用 dot，并以 edge 贴住按钮圆弧。
				</p>
				<CodeCard code={dotSource} language="tsx" lineNumbers collapseLines={6}>
					<BadgeDotDemo />
				</CodeCard>
			</section>

			<section aria-labelledby="badge-api" className="space-y-8">
				<h2 id="badge-api" className="text-xl font-bold text-foreground">
					API 参考
				</h2>
				<ApiTable
					title="Badge Props"
					columns={PROP_COLUMNS}
					rows={BADGE_PROPS}
					rowKey={(row) => row.name}
				/>
				<ApiTable
					title="BadgeAnchor Props"
					columns={PROP_COLUMNS}
					rows={ANCHOR_PROPS}
					rowKey={(row) => row.name}
				/>
			</section>

			<section aria-labelledby="badge-guidance" className="space-y-4">
				<h2 id="badge-guidance" className="text-xl font-bold text-foreground">
					使用边界
				</h2>
				<ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground">
					<li>
						BadgeAnchor 的角标不接收点击、对读屏隐藏；真实未读数要写在触发器 Button 的
						aria-label 中，包括零计数状态。
					</li>
					<li>
						数量角标贴近按钮右上圆弧，并向外延伸；状态点直接贴合圆弧。祖先若裁切溢出，数量角标顶部至少留
						8px，并与邻近操作保持间距。
					</li>
				</ul>
			</section>
		</article>
	);
}
