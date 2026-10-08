import { ApiTable, type ApiTableColumn } from "@features/ui-docs/ui/ApiTable";
import { ComponentDoc } from "@features/ui-docs/ui/ComponentDoc";
import { ImagePixelRevealBasicDemo } from "@features/ui-docs/ui/examples/image-pixel-reveal/basic";
import basicSource from "@features/ui-docs/ui/examples/image-pixel-reveal/basic.tsx?raw";
import { AnchoredHeading } from "@shared/ui/anchored-heading";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";

interface PropRow {
	name: string;
	type: string;
	defaultValue: string;
	meaning: string;
}

const COLUMNS: ApiTableColumn<PropRow>[] = [
	{ label: "属性", cellClassName: "font-mono text-foreground", render: (row) => row.name },
	{ label: "类型", cellClassName: "font-mono text-muted-foreground", render: (row) => row.type },
	{ label: "默认值", render: (row) => row.defaultValue },
	{ label: "说明", cellClassName: "text-muted-foreground", render: (row) => row.meaning },
];

const ROWS: PropRow[] = [
	{
		name: "src",
		type: "string",
		defaultValue: "必填",
		meaning: "图片资源；变化时开始独立的加载与揭示周期，旧周期不会完成新图片的揭示。",
	},
	{
		name: "alt",
		type: "string",
		defaultValue: '""',
		meaning:
			"默认图片的替代文本；有信息含义的图片应提供描述。自定义 children 由调用方提供可访问名称。",
	},
	{
		name: "variant",
		type: "PixelRevealVariant",
		defaultValue: '"random"',
		meaning: "random、ripple、diagonal、curtain；改变瓦片展开的先后顺序，random 每轮重新洗牌。",
	},
	{
		name: "tileSize / maxTiles",
		type: "number / number",
		defaultValue: "44 / 64",
		meaning: "网格基准尺寸（px）和格数上限；大容器会调粗网格以限制格数。",
	},
	{
		name: "duration / spreadMs",
		type: "number / number",
		defaultValue: "0.32 / 380",
		meaning: "单格裁剪展开时长（秒）与各格起始延迟的跨度（毫秒）；默认总时长约 700ms。",
	},
	{
		name: "replayOnHover",
		type: "boolean",
		defaultValue: "false",
		meaning: "完整揭示后，悬停重新播放同样的瓦片拼合；播放中再次进入不会重启当前周期。",
	},
	{
		name: "className",
		type: "string",
		defaultValue: "—",
		meaning: "属于根容器；设置宽高、长宽比、圆角和裁剪。组件尺寸由容器约束，不靠图片动画撑开。",
	},
	{
		name: "imgClassName",
		type: "string",
		defaultValue: "—",
		meaning:
			"属于默认 img；用于 object-fit 等图片局部样式。传入 children 后，由调用方设置其图片样式。",
	},
	{
		name: "loading",
		type: '"eager" | "lazy"',
		defaultValue: '"lazy"',
		meaning:
			"默认图片或自定义内容的加载探针使用的原生 loading 属性；首屏关键图片可选择 eager。",
	},
	{
		name: "children",
		type: "ReactNode",
		defaultValue: "—",
		meaning:
			"替换默认图片内容，仍被同一遮罩揭示；src 作为加载探针，children 的布局、图片资源与语义由调用方负责。",
	},
	{
		name: "onError / onRevealed",
		type: "() => void",
		defaultValue: "—",
		meaning:
			"分别通知 src 加载失败与揭示完成；减弱动态直接显示也会完成揭示，悬停重播完成也会通知。",
	},
	{
		name: "ref / 原生 div 属性",
		type: 'ComponentProps<"div">',
		defaultValue: "—",
		meaning:
			"ref、id、style、aria-*、data-* 和事件透传给根容器；onMouseEnter 阻止默认行为可取消本次悬停重播。",
	},
];

export function ImagePixelRevealDocPage() {
	return (
		<ComponentDoc componentId="image-pixel-reveal">
			<article className="space-y-12 pb-24 font-sans">
				<header className="space-y-3">
					<p className="font-mono text-xs text-muted-foreground">
						图片 · ImagePixelReveal
					</p>
					<h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
						ImagePixelReveal 网格揭示
					</h1>
					<p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
						小瓦片逐块展开、拼合成完整图片，不是白色网格淡出。
						同一张原图始终静止，只扩大各瓦片的可见范围；结束后保留同一合成层，不换图。
					</p>
					<p className="text-xs text-muted-foreground">
						源码{" "}
						<code className="font-mono text-foreground">
							web/packages/ui/src/components/image-pixel-reveal/image-pixel-reveal.tsx
						</code>
					</p>
				</header>

				<section aria-labelledby="image-pixel-reveal-usage" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="image-pixel-reveal-usage"
						className="text-xl font-bold text-foreground"
					>
						可操作示例
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						组件和公开类型 ImagePixelRevealProps、PixelRevealVariant 从 @violet/ui
						根入口导入。 示例图片是内嵌 SVG data
						URI，不需要站点头像配置、图片服务或额外文件。 选择顺序会完整重播；也可切换
						src、启用自定义 children，再移入图片重播瓦片拼合。
					</p>
					<CodeCard code={basicSource} language="tsx" lineNumbers collapseLines={12}>
						<ImagePixelRevealBasicDemo />
					</CodeCard>
				</section>

				<section aria-labelledby="image-pixel-reveal-behavior" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="image-pixel-reveal-behavior"
						className="text-xl font-bold text-foreground"
					>
						顺序与生命周期
					</AnchoredHeading>
					<ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
						<li>random：默认顺序；每次播放重新洗牌，让瓦片在不同位置交错展开。</li>
						<li>ripple：从中心向四周扩散。</li>
						<li>diagonal：从左上向右下逐块展开。</li>
						<li>curtain：从上到下按行展开。</li>
					</ul>
					<p className="text-sm leading-relaxed text-muted-foreground">
						首次揭示等待 src 加载；根节点 data-state 依次为
						loading、revealing、revealed。 src
						改变会开始新周期。更改顺序并不会主动重新加载图片，示例使用 key
						重新挂载来完整重播；无需为生产调用方增加重播状态。
					</p>
					<p className="text-sm leading-relaxed text-muted-foreground">
						replayOnHover 仅在完整揭示后生效，重新播放瓦片展开；原图本身不缩放或平移。
						prefers-reduced-motion: reduce 时直接显示已加载内容，跳过首次与悬停动画。
						播放中开启该偏好也会立即完成当前周期，onRevealed 只通知一次。
						这是装饰性揭示，不给图片增加按钮、焦点或键盘操作；示例控制项使用原生可访问控件。
					</p>
				</section>

				<section aria-labelledby="image-pixel-reveal-layout" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="image-pixel-reveal-layout"
						className="text-xl font-bold text-foreground"
					>
						尺寸、样式与组合
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						先用 className 为根容器约束宽高或长宽比，再用 imgClassName
						控制默认图片的适配方式。 例如示例以 aspect-5/3 保留位置，图片使用
						object-cover。传入 children 时不会再渲染默认图片，
						请为自定义内容提供尺寸和替代文本；其图片及说明一起由同一层遮罩揭示。
					</p>
					<p className="text-sm leading-relaxed text-muted-foreground">
						完整样式随 @violet/ui/styles.css 加载；按需加载则先引入
						@violet/ui/tokens.css， 再引入
						@violet/ui/components/image-pixel-reveal.css。SVG 遮罩只控制可见区域，
						不往图片覆盖纯色，也不依赖博客资源或站点别名。
					</p>
					<p className="text-sm leading-relaxed text-muted-foreground">
						根类为 .v-image-pixel-reveal，部件使用
						__content、__image、__tiles、__mask、__base、__tile、__probe
						后缀。样式覆盖不能给原图添加 transform
						或在揭示结束时改变尺寸，否则会破坏静止图片的约束。
					</p>
				</section>

				<section aria-labelledby="image-pixel-reveal-api" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="image-pixel-reveal-api"
						className="text-xl font-bold text-foreground"
					>
						API
					</AnchoredHeading>
					<ApiTable
						title="ImagePixelRevealProps"
						columns={COLUMNS}
						rows={ROWS}
						rowKey={(row) => row.name}
					/>
				</section>
			</article>
		</ComponentDoc>
	);
}
