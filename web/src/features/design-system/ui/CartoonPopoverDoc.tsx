import { slugify } from "@shared/lib/slug";
import { AnchoredHeading } from "@shared/ui/anchored-heading";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { ApiTable, type ApiTableColumn } from "./ApiTable";
import { CartoonPopoverBasicDemo } from "./examples/cartoon-popover/basic";
import basicSource from "./examples/cartoon-popover/basic.tsx?raw";
import { CartoonPopoverGroupDemo } from "./examples/cartoon-popover/group";
import groupSource from "./examples/cartoon-popover/group.tsx?raw";
import { CartoonPopoverHoverDemo } from "./examples/cartoon-popover/hover";
import hoverSource from "./examples/cartoon-popover/hover.tsx?raw";
import { CartoonPopoverStylesDemo } from "./examples/cartoon-popover/styles";
import stylesSource from "./examples/cartoon-popover/styles.tsx?raw";
import { SpecimenDoc } from "./SpecimenDoc";

interface PropRow {
	name: string;
	type: string;
	defaultValue: string;
	meaning: string;
}

const PROP_COLUMNS: ApiTableColumn<PropRow>[] = [
	{
		label: "属性",
		render: (row) => (
			<span className="font-mono text-xs font-semibold text-foreground">{row.name}</span>
		),
	},
	{
		label: "类型",
		render: (row) => (
			<span className="font-mono text-[11px] text-muted-foreground">{row.type}</span>
		),
	},
	{
		label: "默认值",
		render: (row) => (
			<span className="font-mono text-xs text-muted-foreground">{row.defaultValue}</span>
		),
	},
	{
		label: "说明",
		render: (row) => <span className="text-xs text-foreground">{row.meaning}</span>,
	},
];

const ROOT_PROPS: PropRow[] = [
	{
		name: "open",
		type: "boolean",
		defaultValue: "—",
		meaning: "受控打开状态。",
	},
	{
		name: "defaultOpen",
		type: "boolean",
		defaultValue: "false",
		meaning: "默认非受控打开状态。",
	},
	{
		name: "onOpenChange",
		type: "(open: boolean) => void",
		defaultValue: "—",
		meaning: "打开或关闭时的状态变更回调。",
	},
	{
		name: "triggerMode",
		type: '"click" | "hover" | "both"',
		defaultValue: '"click"',
		meaning: "触发模式：仅点击、仅悬停、或两者均可。",
	},
	{
		name: "openOnHover",
		type: "boolean",
		defaultValue: "false",
		meaning: '快捷开启悬停触发，等价于 triggerMode="both"。',
	},
	{
		name: "hoverDelay",
		type: "number",
		defaultValue: "80",
		meaning: "鼠标悬停触发的防抖延迟时间（毫秒）。",
	},
	{
		name: "closeDelay",
		type: "number",
		defaultValue: "150",
		meaning: "鼠标离开触发器和气泡的关闭缓冲延迟（毫秒），允许鼠标移入气泡操作。",
	},
];

const CONTENT_PROPS: PropRow[] = [
	{
		name: "side",
		type: '"top" | "bottom" | "left" | "right"',
		defaultValue: '"bottom"',
		meaning: "期望展示在触发器的哪一侧；空间不足时自动翻转。",
	},
	{
		name: "align",
		type: '"start" | "center" | "end"',
		defaultValue: '"center"',
		meaning: "相对触发器的对齐方式。",
	},
	{
		name: "sideOffset",
		type: "number",
		defaultValue: "14",
		meaning: "气泡与触发器的间距（像素），尾巴凸出 8px 保留安全呼吸感。",
	},
	{
		name: "bubbleStyle",
		type: '"speech" | "sticker"',
		defaultValue: '"speech"',
		meaning: "气泡形态：经典对白三角形尾巴，或无尾巴的便签贴纸卡片。",
	},
	{
		name: "variant",
		type: '"default" | "primary" | "amber" | "mint" | "rose" | "sky" | "dark"',
		defaultValue: '"default"',
		meaning: "卡通色彩变体，自动匹配气泡背景、描边与尾巴颜色。",
	},
	{
		name: "shadowStyle",
		type: '"soft" | "comic"',
		defaultValue: '"soft"',
		meaning: "投影风格：遵循站内规范的轻微软影或 3px 漫画实色投影。",
	},
	{
		name: "showArrow",
		type: "boolean",
		defaultValue: "true",
		meaning: "是否渲染指向触发器中心的气泡小尾巴，已消除边框横线阻隔。",
	},
	{
		name: "showShine",
		type: "boolean",
		defaultValue: "true",
		meaning: "是否在气泡内壁渲染卡通高光微胶囊。",
	},
	{
		name: "title",
		type: "ReactNode",
		defaultValue: "—",
		meaning: "可选快捷标题；传入时自动渲染头部。",
	},
	{
		name: "divided",
		type: "boolean",
		defaultValue: "false",
		meaning: "头部与正文之间是否显示虚线分隔线（默认不显示）。",
	},
	{
		name: "showClose",
		type: "boolean",
		defaultValue: "false",
		meaning: "是否渲染右上角卡通圆形关闭按钮。",
	},
];

const GROUP_PROPS: PropRow[] = [
	{
		name: "sideOffset",
		type: "number",
		defaultValue: "14",
		meaning: "浮层与触发器的间距（像素）。",
	},
	{
		name: "closeDelay",
		type: "number",
		defaultValue: "180",
		meaning: "鼠标离开整排群组的收起缓冲延迟（毫秒）。",
	},
];

export function CartoonPopoverDocPage() {
	return (
		<SpecimenDoc>
			<article className="space-y-12 pb-16">
				{/* 头部导言 */}
				<header className="space-y-3">
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<span>浮层</span>
						<span aria-hidden="true">·</span>
						<span>CartoonPopover</span>
					</div>
					<h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
						CartoonPopover 卡通气泡
					</h1>
					<p className="text-sm leading-relaxed text-muted-foreground">
						轮廓从小尾巴尖端起笔、一笔连通圆角边框向两侧描绘，关闭时沿原路收回并淡去，不缩放整块内容。并排触发器间连续滑行，减少动效时即时开合。
					</p>
					<p className="font-mono text-xs text-muted-foreground">
						源码 web/src/shared/ui/cartoon-popover/CartoonPopover.tsx
					</p>
				</header>

				{/* 基础用法演练 */}
				<section aria-labelledby="usage-heading" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="usage-heading"
						className="text-xl font-semibold text-foreground"
					>
						用法
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						从 shared/ui/cartoon-popover 导入。点击触发器即可弹出，支持外部点击与 Escape
						自动关闭。
					</p>
					<CodeCard code={basicSource} language="tsx" lineNumbers collapseLines={6}>
						<CartoonPopoverBasicDemo />
					</CodeCard>
				</section>

				{/* 连续平滑滑动群组 */}
				<section aria-labelledby="group-heading" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="group-heading"
						className="text-xl font-semibold text-foreground"
					>
						并排连续平滑移动 (CartoonPopoverGroup)
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						当有一排带有 Popover 的按钮时，使用 CartoonPopoverGroup
						包裹。鼠标在组内滑过时浮层连续滑动并随内容调整尺寸；完全离开后沿轮廓收起，再次进入从新位置描线淡入。系统启用「减少动态效果」时即时开合。
					</p>
					<CodeCard code={groupSource} language="tsx" lineNumbers collapseLines={6}>
						<CartoonPopoverGroupDemo />
					</CodeCard>
				</section>

				{/* 悬停与触发方式 */}
				<section aria-labelledby="hover-heading" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="hover-heading"
						className="text-xl font-semibold text-foreground"
					>
						触发方式 (triggerMode & hover)
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						支持仅点击（click）、仅悬停（hover）或两者兼具（both /
						openOnHover）。悬停模式下移入气泡内容区保持打开，鼠标离开后平滑收起。
					</p>
					<CodeCard code={hoverSource} language="tsx" lineNumbers collapseLines={6}>
						<CartoonPopoverHoverDemo />
					</CodeCard>
				</section>

				{/* 气泡形态 */}
				<section aria-labelledby="styles-heading" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="styles-heading"
						className="text-xl font-semibold text-foreground"
					>
						气泡形态 (bubbleStyle)
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						提供带三角形小尾巴的经典对白气泡（speech）与无尾巴的便签贴纸（sticker）。
					</p>
					<CodeCard code={stylesSource} language="tsx" lineNumbers collapseLines={6}>
						<CartoonPopoverStylesDemo />
					</CodeCard>
				</section>

				{/* API 参数契约表格 */}
				<section aria-labelledby="api-heading" className="space-y-6">
					<AnchoredHeading
						as="h2"
						id="api-heading"
						className="text-xl font-semibold text-foreground"
					>
						公开契约
					</AnchoredHeading>

					<div className="space-y-3">
						<AnchoredHeading
							as="h3"
							id={slugify("CartoonPopover 根组件参数")}
							className="text-sm font-semibold text-foreground"
						>
							CartoonPopover 根组件参数
						</AnchoredHeading>
						<ApiTable<PropRow>
							title="CartoonPopover 根组件参数"
							columns={PROP_COLUMNS}
							rows={ROOT_PROPS}
							rowKey={(r) => r.name}
						/>
					</div>

					<div className="space-y-3">
						<AnchoredHeading
							as="h3"
							id={slugify("CartoonPopoverGroup 群组参数")}
							className="text-sm font-semibold text-foreground"
						>
							CartoonPopoverGroup 群组参数
						</AnchoredHeading>
						<ApiTable<PropRow>
							title="CartoonPopoverGroup 参数"
							columns={PROP_COLUMNS}
							rows={GROUP_PROPS}
							rowKey={(r) => r.name}
						/>
					</div>

					<div className="space-y-3">
						<AnchoredHeading
							as="h3"
							id={slugify("CartoonPopoverContent 内容面板参数")}
							className="text-sm font-semibold text-foreground"
						>
							CartoonPopoverContent 内容面板参数
						</AnchoredHeading>
						<ApiTable<PropRow>
							title="CartoonPopoverContent 参数"
							columns={PROP_COLUMNS}
							rows={CONTENT_PROPS}
							rowKey={(r) => r.name}
						/>
					</div>
				</section>
			</article>
		</SpecimenDoc>
	);
}
