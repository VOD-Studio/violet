import { AnchoredHeading } from "@shared/ui/anchored-heading";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { ApiTable, type ApiTableColumn } from "./ApiTable";
import { ComponentDoc } from "./ComponentDoc";
import { TabsBasicDemo } from "./examples/tabs/basic";
import basicSource from "./examples/tabs/basic.tsx?raw";

interface PropRow {
	name: string;
	type: string;
	meaning: string;
}

const COLUMNS: ApiTableColumn<PropRow>[] = [
	{ label: "组件 / 属性", cellClassName: "font-mono text-foreground", render: (row) => row.name },
	{ label: "类型", cellClassName: "font-mono text-muted-foreground", render: (row) => row.type },
	{ label: "用途", cellClassName: "text-muted-foreground", render: (row) => row.meaning },
];

const ROWS: PropRow[] = [
	{
		name: "Tabs",
		type: "defaultValue?, value?, onValueChange?",
		meaning: "根组件；使用 defaultValue 设置初始标签，或通过 value / onValueChange 受控。",
	},
	{
		name: "Tabs.orientation",
		type: '"horizontal" | "vertical"',
		meaning: "默认 horizontal；垂直布局需要配合合适的容器宽度。",
	},
	{
		name: "TabsList.variant",
		type: '"default" | "line"',
		meaning: "列表外观，默认带底色，也可选择下划线样式。",
	},
	{
		name: "TabsTrigger.value",
		type: "string",
		meaning: "切换目标，与对应 TabsContent 的 value 保持一致；可设置 disabled。",
	},
	{ name: "TabsContent.value", type: "string", meaning: "只呈现当前选中标签对应的内容。" },
];

/** 展示 @violet/ui Tabs 的内容切换与键盘行为。 */
export function TabsDocPage() {
	return (
		<ComponentDoc componentId="tabs">
			<article className="space-y-12 pb-24 font-sans">
				<header className="space-y-3">
					<p className="font-mono text-xs text-muted-foreground">导航 · Tabs</p>
					<h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
						Tabs 标签页
					</h1>
					<p className="text-base leading-relaxed text-muted-foreground">
						在同一区域内切换彼此相关的内容，保持每个触发器与内容面板的 value 对应。
					</p>
					<p className="text-xs text-muted-foreground">
						源码{" "}
						<code className="font-mono text-foreground">
							web/packages/ui/src/components/tabs/tabs.tsx
						</code>
					</p>
				</header>

				<section aria-labelledby="tabs-usage" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="tabs-usage"
						className="text-xl font-bold text-foreground"
					>
						用法
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						从 <code className="font-mono">@violet/ui</code>{" "}
						导入组合件；点击标签即可切换实际内容。
					</p>
					<CodeCard code={basicSource} language="tsx" lineNumbers collapseLines={6}>
						<TabsBasicDemo />
					</CodeCard>
				</section>

				<section aria-labelledby="tabs-api" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="tabs-api"
						className="text-xl font-bold text-foreground"
					>
						API 与键盘
					</AnchoredHeading>
					<ApiTable
						title="Tabs 关键组合件"
						columns={COLUMNS}
						rows={ROWS}
						rowKey={(row) => row.name}
					/>
					<p className="text-sm leading-relaxed text-muted-foreground">
						基于 Radix
						Tabs：聚焦标签列表后，水平排列使用左右方向键、垂直排列使用上下方向键；Home /
						End 跳到首项 / 末项。默认自动激活聚焦标签；也可在 Tabs 上指定
						activationMode="manual" 改为按 Enter 或空格激活。
					</p>
					<p className="text-sm leading-relaxed text-muted-foreground">
						限制：Tabs 不替你加载远程数据，也不把当前标签写入
						URL；需要路由或异步数据同步时由消费方通过 value / onValueChange 接入。
					</p>
				</section>
			</article>
		</ComponentDoc>
	);
}
