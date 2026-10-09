import { ApiTable, type ApiTableColumn } from "@features/ui-docs/ui/ApiTable";
import { ComponentDoc } from "@features/ui-docs/ui/ComponentDoc";
import { SegmentedBasicDemo } from "@features/ui-docs/ui/examples/segmented/basic";
import basicSource from "@features/ui-docs/ui/examples/segmented/basic.tsx?raw";
import { SegmentedExpandDemo } from "@features/ui-docs/ui/examples/segmented/expand";
import expandSource from "@features/ui-docs/ui/examples/segmented/expand.tsx?raw";
import { SegmentedOrientationDemo } from "@features/ui-docs/ui/examples/segmented/orientation";
import orientationSource from "@features/ui-docs/ui/examples/segmented/orientation.tsx?raw";
import { SegmentedRenderDemo } from "@features/ui-docs/ui/examples/segmented/render";
import renderSource from "@features/ui-docs/ui/examples/segmented/render.tsx?raw";
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

const SEGMENTED_ROWS: PropRow[] = [
	{
		name: "value",
		type: "string",
		meaning: "当前选中值，受控；不匹配任何分段时没有选中项，指示器隐藏。",
	},
	{
		name: "onValueChange",
		type: "(value) => void",
		meaning: "点击分段时回调，可省略；链接分段靠自身导航时通常不需要。",
	},
	{ name: "segments", type: "SegmentedItem[]", meaning: "分段列表。" },
	{
		name: "orientation",
		type: '"horizontal" | "vertical"',
		meaning: "排布方向，默认 horizontal。",
	},
	{
		name: "variant",
		type: '"soft" | "ink" | "line"',
		meaning:
			"soft 是浮在 muted 轨道上的滑块；ink 是实心前景色药丸，轨道底色由使用方给出；line 无底色，用 2px 墨线标出当前项。默认 soft。",
	},
	{
		name: "size",
		type: '"sm" | "default" | "lg"',
		meaning: "尺寸，默认 sm，与按钮高度对齐；竖向时决定每项的高度。",
	},
	{ name: "block", type: "boolean", meaning: "沿主轴撑满容器，各段等分。" },
	{
		name: "rounded",
		type: '"default" | "full"',
		meaning: "外轮廓形状，默认 default。",
	},
	{ name: "disabled", type: "boolean", meaning: "整体禁用。" },
	{
		name: "itemSize",
		type: "string",
		meaning:
			"CSS 长度。设置后进入等尺寸布局：每项沿主轴恰为该尺寸（乘以 weight），指示器几何只由 CSS 变量驱动；总长由它决定，block 在此不再拉伸容器。",
	},
	{
		name: "collapsedSize",
		type: "string",
		meaning: "expandSelected 时未选中项的主轴尺寸，默认 2.25rem。",
	},
	{
		name: "expandSelected",
		type: "boolean",
		meaning: "需要 itemSize：选中项占满剩余长度，其余收为只剩图标，主轴总尺寸不变。",
	},
	{
		name: "aria-label",
		type: "string",
		meaning: "提供后容器带 role=group 与该名称；没有它时不输出 role。",
	},
	{
		name: "className / style / ref",
		type: "string / CSSProperties / Ref<HTMLDivElement>",
		meaning: "落在容器节点。",
	},
	{
		name: "indicatorClassName",
		type: "string",
		meaning: "滑块指示器的自定义类名。",
	},
	{
		name: "itemClassName / activeItemClassName",
		type: "string",
		meaning: "每个分段与激活分段的自定义类名。",
	},
];

const ITEM_ROWS: PropRow[] = [
	{ name: "value", type: "string", meaning: "分段值，在列表内唯一。" },
	{ name: "label", type: "ReactNode", meaning: "显示内容，文本或图标。" },
	{
		name: "icon",
		type: "ReactNode",
		meaning: "图标；expandSelected 收起时只剩它。",
	},
	{
		name: "trailing",
		type: "ReactNode",
		meaning: "尾部装饰，例如 chevron；收起时随文字一起折叠。",
	},
	{ name: "title", type: "string", meaning: "原生 tooltip；收起为图标时建议提供。" },
	{ name: "disabled", type: "boolean", meaning: "禁用该分段，方向键与点击都会跳过。" },
	{
		name: "render",
		type: "(props, { active, disabled }) => ReactElement",
		meaning:
			"自定义元素，如链接或被 Dropdown 触发器包裹的元素；必须展开 props，指示器与键盘导航依赖其中的数据属性。",
	},
	{
		name: "weight",
		type: "number",
		meaning:
			"需要 itemSize：该项占 itemSize 的倍数长度，默认 1；带更多图标的项（如分组按钮加箭头）可加宽，使内边距与其余项一致。",
	},
];

/** 展示 Segmented 的方向、变体、等尺寸收起与自定义元素，并说明键盘与动效约束。 */
export function SegmentedDocPage() {
	return (
		<ComponentDoc componentId="segmented">
			<article className="space-y-12 pb-24 font-sans">
				<header className="space-y-3">
					<p className="font-mono text-xs text-muted-foreground">导航 · Segmented</p>
					<h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
						Segmented 分段控制
					</h1>
					<p className="text-base leading-relaxed text-muted-foreground">
						在少量互斥选项间切换的控制条，带一个随选中项平移的指示器。横向与竖向共用同一套实现，既可当按钮组，也可承载链接。
					</p>
				</header>
				<section aria-labelledby="segmented-usage" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="segmented-usage"
						className="text-xl font-bold text-foreground"
					>
						用法
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						从 @violet/ui 或 @violet/ui/segmented 导入 Segmented；value 受控，segments
						描述各段，每段可带 icon、trailing，也可用 render 换成自己的元素。
					</p>
					<CodeCard code={basicSource} language="tsx" lineNumbers collapseLines={12}>
						<SegmentedBasicDemo />
					</CodeCard>
				</section>
				<section aria-labelledby="segmented-variants" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="segmented-variants"
						className="text-xl font-bold text-foreground"
					>
						方向与变体
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						orientation 决定横向或竖向，variant 决定 soft、ink、line
						三种外观。示例里三个变体共用同一个值，ink 的轨道底色由类名给出。
					</p>
					<CodeCard
						code={orientationSource}
						language="tsx"
						lineNumbers
						collapseLines={12}
					>
						<SegmentedOrientationDemo />
					</CodeCard>
				</section>
				<section aria-labelledby="segmented-expand" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="segmented-expand"
						className="text-xl font-bold text-foreground"
					>
						等尺寸与收起选中项
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						itemSize 让每个分段沿主轴恰为同一长度，指示器几何只由 CSS 变量驱动。再加上
						expandSelected，选中项占满剩余长度，其余分段收成只剩图标，总长度不变；示例随选中项切换下方标题。
					</p>
					<CodeCard code={expandSource} language="tsx" lineNumbers collapseLines={12}>
						<SegmentedExpandDemo />
					</CodeCard>
				</section>
				<section aria-labelledby="segmented-render" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="segmented-render"
						className="text-xl font-bold text-foreground"
					>
						自定义元素
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						render
						回调拿到与默认按钮相同的一份属性，展开到链接即可作为导航分段；站点头部就是这样把分段与
						Dropdown 触发器组合在一起。链接项用 aria-current 表达当前页，不带
						aria-pressed。
					</p>
					<CodeCard code={renderSource} language="tsx" lineNumbers collapseLines={12}>
						<SegmentedRenderDemo />
					</CodeCard>
				</section>
				<section aria-labelledby="segmented-api" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="segmented-api"
						className="text-xl font-bold text-foreground"
					>
						API 与键盘
					</AnchoredHeading>
					<ApiTable
						title="SegmentedProps"
						columns={COLUMNS}
						rows={SEGMENTED_ROWS}
						rowKey={(row) => row.name}
					/>
					<ApiTable
						title="SegmentedItem"
						columns={COLUMNS}
						rows={ITEM_ROWS}
						rowKey={(row) => row.name}
					/>
					<p className="text-sm leading-relaxed text-muted-foreground">
						方向键只移动焦点，不改变选中值，也不改变 Tab 停靠点：横向用 ←/→，竖向用
						↑/↓，Home 与 End 跳到首尾，禁用项会被跳过。容器只在提供 aria-label 时带
						role=group；默认的按钮分段带 aria-pressed，链接分段自行用 aria-current。
					</p>
				</section>
				<section aria-labelledby="segmented-motion" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="segmented-motion"
						className="text-xl font-bold text-foreground"
					>
						动效说明
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						指示器的位移走
						transform，在合成层完成，只有它的尺寸是布局过渡；不缩放。默认模式按激活项的实际尺寸测量，所以各段文字长度不同也能精确包裹；等尺寸模式不做任何
						JavaScript 测量，几何完全由 CSS
						变量得出。首次定位不播放动画，启用减弱动态时所有动效关闭。
					</p>
				</section>
				<section aria-labelledby="segmented-css" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="segmented-css"
						className="text-xl font-bold text-foreground"
					>
						CSS 入口
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						Tailwind v4 宿主在 Tailwind 后加载 @violet/ui/styles.css；普通 CSS
						宿主先加载 @violet/ui/tokens.css，再加载
						@violet/ui/components/segmented.css，样式类以 .v-segmented 开头。
					</p>
				</section>
			</article>
		</ComponentDoc>
	);
}
