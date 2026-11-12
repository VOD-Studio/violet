import { Breadcrumbs, Button, PageHeader, Steps, Tabs, TabsList, TabsTrigger } from "@violet/ui";
import { Download, Ellipsis, Plus } from "lucide-react";
import { useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const CRUMBS = [{ label: "内容", href: "/admin" }, { label: "文章" }];

const LONG_CRUMBS = [
	{ label: "项目", href: "/projects" },
	{ label: "Violet", href: "/projects/violet" },
	{ label: "设计稿", href: "/projects/violet/design" },
	{ label: "组件", href: "/projects/violet/design/components" },
	{ label: "组件库", href: "/projects/violet/design/components/ui" },
	{ label: "按钮" },
];

const STEPS = [
	{ title: "填写信息", description: "作者与标题" },
	{ title: "验证站点", description: "检查域名与 RSS" },
	{ title: "设置自动发布", description: "推送到 release/2.0 时发布" },
	{ title: "完成" },
];

function ListHeader() {
	return (
		<PageHeader
			title="文章"
			breadcrumbs={<Breadcrumbs items={CRUMBS} />}
			description="共 270 篇，3 篇待发布"
			actions={
				<Button variant="ghost" size="sm">
					<Download className="size-4" />
					导出
				</Button>
			}
			primaryAction={
				<Button variant="primary" size="sm">
					<Plus className="size-4" />
					写文章
				</Button>
			}
		/>
	);
}

function SectionHeader() {
	const [tab, setTab] = useState("site");
	return (
		<PageHeader
			title="设置"
			breadcrumbs={
				<Breadcrumbs items={[{ label: "管理", href: "/admin" }, { label: "设置" }]} />
			}
			description="站点信息、外观与集成"
			tabs={
				<Tabs value={tab} onValueChange={setTab}>
					<TabsList>
						<TabsTrigger value="site">站点</TabsTrigger>
						<TabsTrigger value="appearance">外观</TabsTrigger>
						<TabsTrigger value="integration">集成</TabsTrigger>
					</TabsList>
				</Tabs>
			}
		/>
	);
}

function DetailHeader() {
	return (
		<div>
			<PageHeader
				title="拆解 Saber"
				back={{ href: "/admin/posts", label: "文章" }}
				status="草稿"
				meta="11-02 14:20 自动保存 · 3,880 字"
				actions={
					<>
						<Button variant="ghost" size="sm">
							预览
						</Button>
						<Button variant="ghost" iconOnly size="sm" aria-label="更多操作">
							<Ellipsis className="size-4" />
						</Button>
					</>
				}
				primaryAction={
					<Button variant="primary" size="sm">
						发布
					</Button>
				}
			/>
			<p className="text-13 text-muted-foreground">正文从这里开始。</p>
		</div>
	);
}

function CompactHeader() {
	return (
		<div>
			<PageHeader
				title="文章"
				description="共 270 篇，3 篇待发布"
				compactSummary="270 篇"
				primaryAction={
					<Button variant="primary" size="sm">
						<Plus className="size-4" />
						写文章
					</Button>
				}
				compact
			/>
			<div className="mt-4 h-24 rounded-12 bg-muted/40 p-4 text-13 text-muted-foreground">
				页面内容在窄条下方滚动。
			</div>
		</div>
	);
}

function HorizontalSteps() {
	const [current, setCurrent] = useState(1);
	const [tone, setTone] = useState<"process" | "error">("process");
	return (
		<div className="flex flex-col gap-5">
			<Steps
				steps={STEPS}
				current={current}
				tone={tone}
				onStepClick={setCurrent}
				aria-label="自动发布流程"
			/>
			<div className="flex gap-2">
				<Button
					size="sm"
					variant="ghost"
					onClick={() => setCurrent(Math.max(0, current - 1))}
				>
					上一步
				</Button>
				<Button
					variant="primary"
					size="sm"
					onClick={() => setCurrent(Math.min(STEPS.length - 1, current + 1))}
				>
					下一步
				</Button>
				<Button
					size="sm"
					variant="ghost"
					onClick={() => setTone(tone === "error" ? "process" : "error")}
				>
					模拟出错
				</Button>
			</div>
		</div>
	);
}

function VerticalSteps() {
	return (
		<div className="w-100">
			<Steps
				steps={STEPS.slice(0, 3)}
				current={1}
				orientation="vertical"
				aria-label="发布流程"
			/>
		</div>
	);
}

function CollapsedBreadcrumbs() {
	return (
		<div className="flex flex-col gap-4">
			<Breadcrumbs items={LONG_CRUMBS} />
			<Breadcrumbs items={CRUMBS} />
		</div>
	);
}

function NarrowBreadcrumbs() {
	return (
		<div className="w-75 rounded-12 border border-border p-4">
			<Breadcrumbs items={LONG_CRUMBS} />
		</div>
	);
}

function HeaderFamily({ state }: ExhibitRenderProps) {
	return (
		<div className="size-full p-6">
			{state === "tabs" ? (
				<SectionHeader />
			) : state === "detail" ? (
				<DetailHeader />
			) : state === "compact" ? (
				<CompactHeader />
			) : state === "steps" ? (
				<HorizontalSteps />
			) : state === "steps-vertical" ? (
				<VerticalSteps />
			) : state === "breadcrumbs" ? (
				<CollapsedBreadcrumbs />
			) : state === "breadcrumbs-narrow" ? (
				<NarrowBreadcrumbs />
			) : (
				<ListHeader />
			)}
		</div>
	);
}

export const pageHeaderExhibit: Exhibit = {
	id: "page-header",
	name: "页头与面包屑",
	units: ["page-header", "breadcrumbs", "steps"],
	zone: "banner",
	category: "navigation",
	footprint: { width: 1120, height: 300 },
	states: [
		{ id: "list", label: "列表页" },
		{ id: "tabs", label: "带分区" },
		{ id: "detail", label: "详情页" },
		{ id: "compact", label: "滚动窄条" },
		{ id: "steps", label: "步骤横排" },
		{ id: "steps-vertical", label: "步骤竖排" },
		{ id: "breadcrumbs", label: "面包屑折叠" },
		{ id: "breadcrumbs-narrow", label: "面包屑窄屏" },
	],
	Render: HeaderFamily,
};
