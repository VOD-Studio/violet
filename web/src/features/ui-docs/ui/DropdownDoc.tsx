import { ApiTable, type ApiTableColumn } from "@features/ui-docs/ui/ApiTable";
import { ComponentDoc } from "@features/ui-docs/ui/ComponentDoc";
import { DropdownBasicDemo } from "@features/ui-docs/ui/examples/dropdown/basic";
import basicSource from "@features/ui-docs/ui/examples/dropdown/basic.tsx?raw";
import { AnchoredHeading } from "@shared/ui/anchored-heading";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";

interface PropRow {
	name: string;
	type: string;
	meaning: string;
}

const COLUMNS: ApiTableColumn<PropRow>[] = [
	{ label: "属性", cellClassName: "font-mono text-foreground", render: (row) => row.name },
	{ label: "类型", cellClassName: "font-mono text-muted-foreground", render: (row) => row.type },
	{ label: "用途", cellClassName: "text-muted-foreground", render: (row) => row.meaning },
];

const DROPDOWN_ROWS: PropRow[] = [
	{
		name: "open / defaultOpen",
		type: "boolean",
		meaning: "受控或非受控的展开状态；非受控默认 false。",
	},
	{
		name: "onOpenChange",
		type: "(open: boolean) => void",
		meaning: "指针停留、键盘聚焦或 Escape 改变展开状态时触发。",
	},
	{
		name: "openDelay",
		type: "number",
		meaning: "指针进入触发器后展开前的等待毫秒数，默认 80。",
	},
	{
		name: "closeDelay",
		type: "number",
		meaning: "指针离开触发器与面板后收起前的宽限毫秒数，默认 140，足够指针穿过两者的间隙。",
	},
];

const GROUP_ROWS: PropRow[] = [
	{
		name: "skipDelay",
		type: "number",
		meaning:
			"组内一个面板收起后，仍视为已预热的毫秒数，默认 400；组内同一时刻只展开一个，切换时后一个立即展开。",
	},
];

const TRIGGER_ROWS: PropRow[] = [
	{
		name: "asChild",
		type: "boolean",
		meaning:
			"把属性与 ref 合并到唯一子元素（通常是链接），保留子元素自己的 click 与 href；自定义组件必须透传属性与 ref。",
	},
	{
		name: "aria-expanded / aria-controls / data-state",
		type: "自动设置",
		meaning:
			"反映展开状态；aria-controls 只在展开时指向面板。默认渲染 type=button 的原生按钮。",
	},
	{
		name: "ref / className / 事件",
		type: "原生 button 或 asChild 子元素属性",
		meaning: "落在触发元素本身；自带的指针与焦点处理会与组件逻辑组合而不是覆盖。",
	},
];

const CONTENT_ROWS: PropRow[] = [
	{
		name: "side",
		type: '"bottom" | "top"',
		meaning: "首选方位，默认 bottom；空间不足时自动翻到对侧。",
	},
	{
		name: "align",
		type: '"start" | "center" | "end"',
		meaning: "与触发器的对齐方式，默认 center。",
	},
	{
		name: "sideOffset",
		type: "number",
		meaning: "面板与触发器的间距，默认 8；透明桥覆盖这段间隙，指针穿过时不会收起。",
	},
	{
		name: "collisionPadding",
		type: "number",
		meaning: "与视口边缘保持的最小距离，默认 8。",
	},
	{
		name: "className / style / ref",
		type: "原生 div 属性",
		meaning: "落在面板节点；最小宽度 12rem，背景取 --popover，只有柔和阴影。",
	},
];

/** 展示悬停与键盘展开的下拉面板，及其与点击型菜单的边界。 */
export function DropdownDocPage() {
	return (
		<ComponentDoc componentId="dropdown">
			<article className="space-y-12 pb-24 font-sans">
				<header className="space-y-3">
					<p className="font-mono text-xs text-muted-foreground">导航 · Dropdown</p>
					<h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
						Dropdown 悬停下拉
					</h1>
					<p className="text-base leading-relaxed text-muted-foreground">
						指针停留或键盘聚焦时展开的面板，用于站点导航里的二级入口。展开只由悬停与焦点决定，点击不参与开合。
					</p>
				</header>
				<section aria-labelledby="dropdown-usage" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="dropdown-usage"
						className="text-xl font-bold text-foreground"
					>
						用法
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						从 @violet/ui 或 @violet/ui/dropdown 导入
						Dropdown、DropdownGroup、DropdownTrigger 与 DropdownContent。示例中
						DropdownGroup 包住两个向下展开的 Dropdown：指针在它们之间移动时只展开一个，
						后一个立即展开；第一个触发器用 asChild 渲染成链接，第二个是默认按钮。
						“向上展开”是组外的独立面板。同组面板使用相同的 side，不混用上下方向。
						面板内容紧随触发器渲染，不入 Portal，Tab 顺序从触发器自然进入面板。
					</p>
					<CodeCard code={basicSource} language="tsx" lineNumbers collapseLines={12}>
						<DropdownBasicDemo />
					</CodeCard>
				</section>
				<section aria-labelledby="dropdown-api" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="dropdown-api"
						className="text-xl font-bold text-foreground"
					>
						API 与键盘
					</AnchoredHeading>
					<ApiTable
						title="DropdownProps"
						columns={COLUMNS}
						rows={DROPDOWN_ROWS}
						rowKey={(row) => row.name}
					/>
					<ApiTable
						title="DropdownGroupProps"
						columns={COLUMNS}
						rows={GROUP_ROWS}
						rowKey={(row) => row.name}
					/>
					<ApiTable
						title="DropdownTriggerProps"
						columns={COLUMNS}
						rows={TRIGGER_ROWS}
						rowKey={(row) => row.name}
					/>
					<ApiTable
						title="DropdownContentProps"
						columns={COLUMNS}
						rows={CONTENT_ROWS}
						rowKey={(row) => row.name}
					/>
					<p className="text-sm leading-relaxed text-muted-foreground">
						鼠标与笔悬停触发器超过 openDelay 后展开，离开触发器与面板超过 closeDelay
						后收起。键盘聚焦触发器 （:focus-visible）立即展开，Tab
						可继续进入面板，焦点移出两者后收起；点按聚焦不会展开。点击触发器或面板内容
						都不会切换或关闭面板，链接跳转等激活行为完全留给触发元素自身。Escape
						收起面板；焦点在面板内时回到触发器，
						此时悬停不会重新展开，指针离开再进入后才恢复。
					</p>
					<p className="text-sm leading-relaxed text-muted-foreground">
						触屏没有悬停，触摸不会展开面板。需要触屏可达时由宿主提供等价入口，例如让触发链接跳转到包含同样选项的页面。
					</p>
				</section>
				<section aria-labelledby="dropdown-menu-diff" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="dropdown-menu-diff"
						className="text-xl font-bold text-foreground"
					>
						与 DropdownMenu 的区别
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						DropdownMenu 是点击触发的 Radix 动作菜单，带菜单语义与方向键导航；Dropdown
						是悬停与焦点展开的披露面板，
						面板里放普通链接或内容，不接管方向键。需要执行动作时用
						DropdownMenu，需要为导航入口展开二级链接时用 Dropdown。
					</p>
				</section>
				<section aria-labelledby="dropdown-css" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="dropdown-css"
						className="text-xl font-bold text-foreground"
					>
						样式入口与动效
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						Tailwind v4 宿主在 Tailwind 后加载 @violet/ui/styles.css；普通 CSS
						宿主先加载 @violet/ui/tokens.css，再加载
						@violet/ui/components/dropdown.css。组件只提供 .v-dropdown__content
						面板样式，行为依赖 JavaScript， 没有脱离 React 的纯 HTML
						用法；面板内的项目样式由宿主决定。
					</p>
					<p className="text-sm leading-relaxed text-muted-foreground">
						下方面板从顶部向下揭开，上方面板从底部向上揭开，关闭时反向收拢；空间不足翻转时，动画跟随实际方位。
						开合不改变透明度，内部文字与图标不做独立动画。 DropdownGroup
						只在同方向面板之间接力，保留位置与尺寸变形，内容按最终宽度静态排版；实际方位不同时各自开合，不做跨方向接力。
						启用减弱动态时所有动效关闭，面板直接出现与消失。
					</p>
				</section>
			</article>
		</ComponentDoc>
	);
}
