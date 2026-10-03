import { slugify } from "@shared/lib/slug";
import { AnchoredHeading } from "@shared/ui/anchored-heading";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { ApiTable, type ApiTableColumn } from "./ApiTable";
import { ButtonBasicDemo } from "./examples/button/basic";
import basicSource from "./examples/button/basic.tsx?raw";
import { ButtonIconsDemo } from "./examples/button/icons";
import iconsSource from "./examples/button/icons.tsx?raw";
import { ButtonLinkDemo } from "./examples/button/link";
import linkSource from "./examples/button/link.tsx?raw";
import { ButtonSizesDemo } from "./examples/button/sizes";
import sizesSource from "./examples/button/sizes.tsx?raw";
import { ButtonStatesDemo } from "./examples/button/states";
import statesSource from "./examples/button/states.tsx?raw";
import { ButtonVariantsDemo } from "./examples/button/variants";
import variantsSource from "./examples/button/variants.tsx?raw";
import { SpecimenDoc } from "./SpecimenDoc";

interface PropRow {
	name: string;
	type: string;
	defaultValue: string;
	meaning: string;
}

const BUTTON_PROPS: PropRow[] = [
	{
		name: "variant",
		type: '"default" | "primary" | "secondary" | "soft" | "outline" | "ghost" | "link" | "destructive"',
		defaultValue: '"default"',
		meaning:
			"视觉层级变体，严格绑定 Violet 语义 Token（primary / primary-base / secondary 等）。",
	},
	{
		name: "size",
		type: '"default" | "xs" | "sm" | "lg" | "xl" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"',
		defaultValue: '"default"',
		meaning: "高度与内外边距规格；纯图标按钮使用 icon 档位并提供 aria-label。",
	},
	{
		name: "loading",
		type: "boolean",
		defaultValue: "false",
		meaning: "自动禁用并设置 aria-busy；指示器覆盖原有图标槽或正文区域，保留占位。",
	},
	{
		name: "loadingText",
		type: "ReactNode",
		defaultValue: "—",
		meaning:
			"原生按钮加载时替换正文，可改变自然宽度；省略时保留原文占位与可访问名称。asChild 不注入该文案。",
	},
	{
		name: "leftIcon",
		type: "ReactNode",
		defaultValue: "—",
		meaning: "按钮前置图标；加载指示器覆盖该槽位，原图标保留占位。asChild 不注入图标。",
	},
	{
		name: "rightIcon",
		type: "ReactNode",
		defaultValue: "—",
		meaning: "按钮后置图标。asChild 模式由子元素提供自己的内容。",
	},
	{
		name: "asChild",
		type: "boolean",
		defaultValue: "false",
		meaning:
			"基于 Radix Slot 合并到唯一子元素；禁用与加载拦截子元素交互，自定义 Link 需透传属性和 ref。",
	},
	{
		name: "disabled",
		type: "boolean",
		defaultValue: "false",
		meaning: "原生 button 禁用；asChild 同时表达 aria-disabled 并阻止点击与键盘激活。",
	},
	{
		name: "type",
		type: '"button" | "submit" | "reset"',
		defaultValue: '"button"',
		meaning: "原生 button 类型；默认为安全防触发表单提交的 button 类型。",
	},
	{
		name: "ref",
		type: "Ref<HTMLButtonElement> | Ref<HTMLElement>",
		defaultValue: "—",
		meaning:
			"原生模式指向 button；asChild 指向子元素，可传 anchor ref。保留 object ref 与 callback ref 的卸载清理。",
	},
	{
		name: "onClick / className",
		type: "button 属性 / HTMLElement 通用属性",
		defaultValue: "—",
		meaning:
			"原生模式事件的 currentTarget 为 HTMLButtonElement，asChild 为 HTMLElement；额外类名用于布局与局部覆盖。",
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

/** 以真实 Button 展示用法、视觉层级、状态和语义边界。 */
export function ButtonDocPage() {
	return (
		<SpecimenDoc>
			<article className="space-y-14 pb-24 font-sans">
				<header className="space-y-3">
					<p className="font-mono text-xs tracking-wider text-muted-foreground">
						动作 · Button
					</p>
					<h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
						Button 按钮
					</h1>
					<p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
						触发操作时用按钮，导航时用链接。这是首批 foundation 组件：原生语义、类型化
						BEM 变体与同一份 CSS，状态反馈使用颜色、描边和透明度。
					</p>
					<p className="text-xs text-muted-foreground">
						源码
						<code className="font-mono text-foreground">
							web/packages/ui/src/components/button/button.tsx
						</code>
					</p>
				</header>

				<section aria-labelledby="button-usage" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="button-usage"
						className="text-xl font-bold text-foreground"
					>
						用法
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						从 @violet/ui 导入。下方按钮可直接操作，点击会更新状态计数。
					</p>
					<CodeCard code={basicSource} language="tsx" lineNumbers collapseLines={6}>
						<ButtonBasicDemo />
					</CodeCard>
				</section>

				<section aria-labelledby="button-examples" className="space-y-12">
					<AnchoredHeading
						as="h2"
						id="button-examples"
						className="text-xl font-bold text-foreground"
					>
						按能力选择示例
					</AnchoredHeading>
					<div className="space-y-3">
						<AnchoredHeading
							as="h3"
							id={slugify("视觉层级 (Variants)")}
							className="text-lg font-semibold text-foreground"
						>
							视觉层级 (Variants)
						</AnchoredHeading>
						<p className="text-sm leading-relaxed text-muted-foreground">
							主要动作使用 default（随方言映射），固定主色强调使用
							primary，柔和辅助使用 soft，描边与次级使用 outline /
							secondary，轻量操作使用 ghost。
						</p>
						<CodeCard
							code={variantsSource}
							language="tsx"
							lineNumbers
							collapseLines={6}
						>
							<ButtonVariantsDemo />
						</CodeCard>
					</div>
					<div className="space-y-3">
						<AnchoredHeading
							as="h3"
							id={slugify("尺寸规格 (Sizes)")}
							className="text-lg font-semibold text-foreground"
						>
							尺寸规格 (Sizes)
						</AnchoredHeading>
						<p className="text-sm leading-relaxed text-muted-foreground">
							包含 xs 到 xl 五个高度梯度；纯图标按钮请使用 icon 档位并提供明确的
							aria-label。
						</p>
						<CodeCard code={sizesSource} language="tsx" lineNumbers collapseLines={6}>
							<ButtonSizesDemo />
						</CodeCard>
					</div>
					<div className="space-y-3">
						<AnchoredHeading
							as="h3"
							id={slugify("图标插槽 (Icons)")}
							className="text-lg font-semibold text-foreground"
						>
							图标插槽 (Icons)
						</AnchoredHeading>
						<p className="text-sm leading-relaxed text-muted-foreground">
							原生按钮支持 leftIcon 与 rightIcon；图标尺寸与间距跟随按钮尺寸。
						</p>
						<CodeCard code={iconsSource} language="tsx" lineNumbers collapseLines={6}>
							<ButtonIconsDemo />
						</CodeCard>
					</div>
					<div className="space-y-3">
						<AnchoredHeading
							as="h3"
							id={slugify("状态与加载 (Loading)")}
							className="text-lg font-semibold text-foreground"
						>
							状态与加载 (Loading)
						</AnchoredHeading>
						<p className="text-sm leading-relaxed text-muted-foreground">
							加载时自动禁用并设置
							aria-busy；原内容保留占位。已有图标槽时覆盖该槽位，没有时在按钮中央显示指示器。显式
							loadingText 可以改变宽度；减弱动态时停止旋转。
						</p>
						<CodeCard code={statesSource} language="tsx" lineNumbers collapseLines={6}>
							<ButtonStatesDemo />
						</CodeCard>
					</div>
					<div className="space-y-3">
						<AnchoredHeading
							as="h3"
							id={slugify("作为导航链接 (asChild)")}
							className="text-lg font-semibold text-foreground"
						>
							作为导航链接 (asChild)
						</AnchoredHeading>
						<p className="text-sm leading-relaxed text-muted-foreground">
							跳转页面使用 Link；asChild 保留子元素内容和链接语义。disabled 或 loading
							会阻止导航和子元素激活 handler。
						</p>
						<p className="text-sm leading-relaxed text-muted-foreground">
							asChild 的 ref 指向真实子元素，事件的 currentTarget 声明为
							HTMLElement；href、target
							等属性放在链接上。需要访问链接专属属性时，将事件 handler 也放在链接上。
						</p>
						<CodeCard code={linkSource} language="tsx" lineNumbers collapseLines={6}>
							<ButtonLinkDemo />
						</CodeCard>
					</div>
				</section>

				<section aria-labelledby="button-api" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="button-api"
						className="text-xl font-bold text-foreground"
					>
						API 契约
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						下表列出 Button 扩展属性与关键语义定义。原生模式支持标准 button
						属性；asChild 模式使用 HTMLElement 的通用属性，子元素专属属性由子元素接收。
					</p>
					<ApiTable
						title="Button Props"
						columns={PROP_COLUMNS}
						rows={BUTTON_PROPS}
						rowKey={(row) => row.name}
					/>
				</section>

				<section aria-labelledby="button-guidance" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="button-guidance"
						className="text-xl font-bold text-foreground"
					>
						使用边界
					</AnchoredHeading>
					<ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
						<li className="border-l-2 border-border pl-4">
							键盘用户通过 Tab 定位时呈现高对比度聚焦描边；严禁使用 className 抹除
							focus-visible 样式。
						</li>
						<li className="border-l-2 border-border pl-4">
							Button 默认 type="button"，表单内主提交操作请显式设置 type="submit"。
						</li>
						<li className="border-l-2 border-border pl-4">
							asChild 的自定义组件必须把 DOM 属性、事件和 ref
							透传到真实元素；此模式不注入 leftIcon、rightIcon 或 loadingText。
						</li>
					</ul>
				</section>
			</article>
		</SpecimenDoc>
	);
}
