import { ApiTable, type ApiTableColumn } from "@features/ui-docs/ui/ApiTable";
import { ComponentDoc } from "@features/ui-docs/ui/ComponentDoc";
import { InputActionsDemo } from "@features/ui-docs/ui/examples/input/actions";
import actionsSource from "@features/ui-docs/ui/examples/input/actions.tsx?raw";
import { InputBasicDemo } from "@features/ui-docs/ui/examples/input/basic";
import basicSource from "@features/ui-docs/ui/examples/input/basic.tsx?raw";
import { InputFormDemo } from "@features/ui-docs/ui/examples/input/form";
import formSource from "@features/ui-docs/ui/examples/input/form.tsx?raw";
import { InputSizesDemo } from "@features/ui-docs/ui/examples/input/sizes";
import sizesSource from "@features/ui-docs/ui/examples/input/sizes.tsx?raw";
import { InputStatesDemo } from "@features/ui-docs/ui/examples/input/states";
import statesSource from "@features/ui-docs/ui/examples/input/states.tsx?raw";
import { InputVariantsDemo } from "@features/ui-docs/ui/examples/input/variants";
import variantsSource from "@features/ui-docs/ui/examples/input/variants.tsx?raw";
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

const ROWS: PropRow[] = [
	{
		name: "variant",
		type: '"outline" | "soft" | "ghost" | "underline"',
		meaning: "默认 outline。四种外观共用原生输入与焦点语义。",
	},
	{
		name: "controlSize",
		type: '"sm" | "md" | "lg"',
		meaning: "默认 md；控件高度为 32 / 40 / 48px。原生 size 仍为 number。",
	},
	{
		name: "leading / trailing",
		type: "ReactNode",
		meaning: "前后辅助内容。装饰图标应设置 aria-hidden；输入文字和图标不位移。",
	},
	{
		name: "clearable / clearLabel",
		type: "boolean / string",
		meaning:
			"默认关闭；默认名称为“清除输入”。清除触发一次真实 onChange，之后焦点回输入框。只读和禁用不可清除。",
	},
	{
		name: "passwordToggle",
		type: "boolean",
		meaning: "默认关闭，仅 type=password 生效；按钮通过 aria-pressed 表达可见状态。",
	},
	{
		name: "showPasswordLabel / hidePasswordLabel",
		type: "string",
		meaning: "自定义密码显隐按钮的可访问名称。",
	},
	{
		name: "label / description / errorMessage",
		type: "ReactNode",
		meaning:
			"可选名称、说明和错误。错误只在 invalid 时显示；0 是有效内容。省略 label 时仍须提供可访问名称。",
	},
	{
		name: "invalid / aria-invalid",
		type: "boolean / 原生 ARIA 属性",
		meaning:
			"显式 invalid 优先；否则沿用 aria-invalid（包括 grammar、spelling）。组件不执行校验。",
	},
	{
		name: "id / aria-describedby",
		type: "string",
		meaning:
			"默认生成 SSR 稳定 ID；宿主说明 ID 保留、去重，并合入实际存在的内部说明和错误节点。",
	},
	{
		name: "value / defaultValue / onChange",
		type: "原生 input 属性",
		meaning: "支持受控和非受控；受控值由调用方决定，不使用 onValueChange。",
	},
	{
		name: "disabled / readOnly / required / form",
		type: "原生 input 属性",
		meaning: "保留原生禁用、只读、必填及外部表单归属。支持 FormData 与可取消的 reset。",
	},
	{
		name: "className / style / ref / 事件",
		type: "原生 input 属性",
		meaning: "始终属于真实 input，不能用于调整外层布局。",
	},
	{
		name: "classNames",
		type: "InputClassNames",
		meaning:
			"root、control、input、label、description、error、leading、trailing、action。root 调整外层布局，control 调整视觉外壳。",
	},
];

/** 展示 Input 的外观、复合焦点与可选字段语义。 */
export function InputDocPage() {
	return (
		<ComponentDoc componentId="input">
			<article className="space-y-12 pb-24 font-sans">
				<header className="space-y-3">
					<p className="font-mono text-xs text-muted-foreground">基础单元 · Input</p>
					<h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
						Input 输入框
					</h1>
					<p className="text-base leading-relaxed text-muted-foreground">
						支持四种外观、清除、密码显隐，以及可选标签和错误信息。
					</p>
					<p className="text-xs text-muted-foreground">
						源码{" "}
						<code className="font-mono text-foreground">
							web/packages/ui/src/components/input/
						</code>
					</p>
				</header>

				<section aria-labelledby="input-variants" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="input-variants"
						className="text-xl font-bold text-foreground"
					>
						四种变体与错误状态
					</AnchoredHeading>
					<CodeCard code={variantsSource} language="tsx" lineNumbers collapseLines={8}>
						<InputVariantsDemo />
					</CodeCard>
				</section>

				<section aria-labelledby="input-sizes" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="input-sizes"
						className="text-xl font-bold text-foreground"
					>
						控件尺寸
					</AnchoredHeading>
					<CodeCard code={sizesSource} language="tsx" lineNumbers collapseLines={8}>
						<InputSizesDemo />
					</CodeCard>
				</section>

				<section aria-labelledby="input-actions" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="input-actions"
						className="text-xl font-bold text-foreground"
					>
						清除与密码显隐
					</AnchoredHeading>
					<CodeCard code={actionsSource} language="tsx" lineNumbers collapseLines={8}>
						<InputActionsDemo />
					</CodeCard>
				</section>

				<section aria-labelledby="input-fields" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="input-fields"
						className="text-xl font-bold text-foreground"
					>
						标签
					</AnchoredHeading>
					<CodeCard code={basicSource} language="tsx" lineNumbers collapseLines={8}>
						<InputBasicDemo />
					</CodeCard>
				</section>

				<section aria-labelledby="input-states" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="input-states"
						className="text-xl font-bold text-foreground"
					>
						只读与禁用
					</AnchoredHeading>
					<CodeCard code={statesSource} language="tsx" lineNumbers collapseLines={8}>
						<InputStatesDemo />
					</CodeCard>
				</section>

				<section aria-labelledby="input-form" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="input-form"
						className="text-xl font-bold text-foreground"
					>
						原生表单
					</AnchoredHeading>
					<CodeCard code={formSource} language="tsx" lineNumbers collapseLines={8}>
						<InputFormDemo />
					</CodeCard>
				</section>

				<section aria-labelledby="input-api" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="input-api"
						className="text-xl font-bold text-foreground"
					>
						API 与可访问性
					</AnchoredHeading>
					<ApiTable
						title="Input 属性"
						columns={COLUMNS}
						rows={ROWS}
						rowKey={(row) => row.name}
					/>
					<p className="text-sm leading-relaxed text-muted-foreground">
						prefers-reduced-motion 下不播放波纹和过渡，直接显示最终聚焦层。
					</p>
				</section>
			</article>
		</ComponentDoc>
	);
}
