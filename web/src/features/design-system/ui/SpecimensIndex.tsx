import { AnchoredHeading } from "@shared/ui/anchored-heading";
import { Link } from "@tanstack/react-router";
import { ALL_NAV_ITEMS } from "../model/navigation";
import { DesignSystemDocHeader } from "./DesignSystemDocHeader";
import { GuideTocContent, GuideTocLayout } from "./LibraryGuideToc";

const COMPONENT_DOCS = ALL_NAV_ITEMS.find((item) => item.id === "specimens")?.children ?? [];

const COMMON_SECTIONS = [
	{
		title: "用途与边界",
		detail: "说明解决什么问题、何时不用，以及项目内的源码位置。不要把库名相似当作 API 相同。",
	},
	{
		title: "引入与最小用法",
		detail: "使用真实导入路径，给出能照着使用的最短示例；必要的 Provider、数据和回调一并交代。",
	},
	{
		title: "真实预览与代码",
		detail: "演示实际组件，代码与画面对应；有交互的组件允许直接操作，不用静态图片冒充。",
	},
	{
		title: "公开契约",
		detail: "只列现有属性、默认值、回调与调用方必须遵守的语义；不照搬别的组件库的属性表。",
	},
	{
		title: "行为与可访问性",
		detail: "交代键盘、焦点和状态语义；仅写该组件实际涉及的关闭、错误或链接行为。",
	},
] as const;

const CAPABILITY_SECTIONS = [
	{
		name: "按钮与动作",
		when: "存在视觉层级、尺寸或不可用状态时",
		show: "展示变体、尺寸、图标、禁用和提交中；说明动作与导航链接的语义差别。",
	},
	{
		name: "表单与控件",
		when: "承接用户输入时",
		show: "展示正常、必填、校验错误、禁用；注明值由谁管理以及提交行为。",
	},
	{
		name: "列表与数据展示",
		when: "依赖异步数据或支持数据操作时",
		show: "展示加载、空数据、错误；仅在组件本身支持时补筛选、排序和分页。",
	},
	{
		name: "弹层与浮层",
		when: "组件会抢占焦点或覆盖页面时",
		show: "展示打开与关闭、Escape / 点击外部、焦点回退，以及长内容的滚动边界。",
	},
	{
		name: "复合业务组件",
		when: "需要数据适配或插槽扩展时",
		show: "说明数据形态、插槽职责和关键状态；不要把调用方业务 API 写成组件自身能力。",
	},
] as const;

/** 组件文档的共通内容与按组件能力选写的栏目。 */
export function SpecimensIndex() {
	return (
		<GuideTocLayout>
			<article className="space-y-6 pb-16">
				<DesignSystemDocHeader
					num="壹"
					title="组件目录"
					scope="从 @violet/ui 导出的组件可通过构建后的 tarball 安装到独立 React 项目；站点私有套件只供对应业务页面调用。各用法页的预览与复制代码来自同一示例文件。"
				/>
				<GuideTocContent>
					<section aria-labelledby="package-components" className="space-y-5">
						<h2 id="package-components" className="text-xl font-bold text-foreground">
							@violet/ui 组件
						</h2>
						<div className="grid gap-3 sm:grid-cols-2">
							{COMPONENT_DOCS.filter((doc) => doc.category === "library").map(
								(doc) => (
									<Link
										key={doc.id}
										to={doc.to}
										className="rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/40"
									>
										<div className="font-mono text-base font-semibold text-foreground">
											{doc.title}
										</div>
										<p className="mt-2 text-sm text-muted-foreground">
											{doc.description}
										</p>
									</Link>
								),
							)}
						</div>
					</section>

					<section aria-labelledby="site-components" className="space-y-4">
						<h2 id="site-components" className="text-xl font-bold text-foreground">
							站点私有套件
						</h2>
						<p className="text-sm text-muted-foreground">
							这些是站点 feature 的展示示例，不属于 @violet/ui 公开导出。
						</p>
						<div className="flex flex-wrap gap-4">
							{COMPONENT_DOCS.filter((doc) => doc.category === "site").map((doc) => (
								<Link
									key={doc.id}
									to={doc.to}
									className="font-mono text-sm text-primary underline underline-offset-4"
								>
									{doc.title}
								</Link>
							))}
						</div>
					</section>

					<section aria-labelledby="common-sections" className="space-y-5">
						<div className="space-y-2 border-b border-border pb-4">
							<h2 id="common-sections" className="text-xl font-bold text-foreground">
								每篇都应回答
							</h2>
							<p className="text-sm leading-relaxed text-muted-foreground">
								读者需要先知道能否使用，再知道怎么使用；栏目名称可以随组件调整。
							</p>
						</div>
						<ol className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
							{COMMON_SECTIONS.map((section, index) => (
								<li key={section.title} className="flex gap-4">
									<span className="shrink-0 font-mono text-sm text-primary">
										{String(index + 1).padStart(2, "0")}
									</span>
									<div className="space-y-1">
										<AnchoredHeading
											as="h3"
											id="{section.title}"
											className="text-base font-semibold text-foreground"
										>
											{section.title}
										</AnchoredHeading>
										<p className="text-sm leading-relaxed text-muted-foreground">
											{section.detail}
										</p>
									</div>
								</li>
							))}
						</ol>
					</section>

					<section aria-labelledby="capability-sections" className="space-y-5">
						<div className="space-y-2 border-b border-border pb-4">
							<h2
								id="capability-sections"
								className="text-xl font-bold text-foreground"
							>
								按能力增补
							</h2>
							<p className="text-sm leading-relaxed text-muted-foreground">
								以下是选题，不是每篇必填的栏目。组件不支持的状态或属性，不写示例。
							</p>
						</div>
						<div className="divide-y divide-border/70">
							{CAPABILITY_SECTIONS.map((section) => (
								<div
									key={section.name}
									className="grid gap-2 py-5 sm:grid-cols-[minmax(8rem,1fr)_2fr] sm:gap-8"
								>
									<div>
										<AnchoredHeading
											as="h3"
											id="{section.name}"
											className="font-semibold text-foreground"
										>
											{section.name}
										</AnchoredHeading>
										<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
											{section.when}
										</p>
									</div>
									<p className="text-sm leading-relaxed text-muted-foreground">
										{section.show}
									</p>
								</div>
							))}
						</div>
					</section>
				</GuideTocContent>
			</article>
		</GuideTocLayout>
	);
}
