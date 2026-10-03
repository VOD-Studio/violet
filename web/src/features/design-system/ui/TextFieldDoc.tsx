import { AnchoredHeading } from "@shared/ui/anchored-heading";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { ApiTable, type ApiTableColumn } from "./ApiTable";
import { TextFieldBasicDemo } from "./examples/text-field/basic";
import basicSource from "./examples/text-field/basic.tsx?raw";
import { TextFieldFormDemo } from "./examples/text-field/form";
import formSource from "./examples/text-field/form.tsx?raw";
import { TextFieldValidationDemo } from "./examples/text-field/validation";
import validationSource from "./examples/text-field/validation.tsx?raw";
import { SpecimenDoc } from "./SpecimenDoc";

interface PropRow {
	name: string;
	type: string;
	meaning: string;
}

const COLUMNS: ApiTableColumn<PropRow>[] = [
	{ label: "属性", cellClassName: "font-mono text-foreground", render: (row) => row.name },
	{ label: "类型", cellClassName: "font-mono text-muted-foreground", render: (row) => row.type },
	{ label: "用途与边界", cellClassName: "text-muted-foreground", render: (row) => row.meaning },
];

const ROWS: PropRow[] = [
	{
		name: "label",
		type: "ReactNode（必填）",
		meaning: "字段名称；通过 htmlFor 关联真实 input。",
	},
	{
		name: "description",
		type: "ReactNode",
		meaning: "存在时渲染说明，并加入 input 的 aria-describedby。",
	},
	{
		name: "errorMessage",
		type: "ReactNode",
		meaning: "只有 invalid 时显示；错误显示时加入 aria-describedby。",
	},
	{
		name: "invalid",
		type: "boolean",
		meaning: "显式值优先；未传时从 aria-invalid 推导字段状态。",
	},
	{ name: "id", type: "string", meaning: "可显式指定；未传时 useId 生成 SSR 稳定的 input ID。" },
	{
		name: "className / style / ref",
		type: "原生 input 属性",
		meaning: "全部落在 input；ref 指向 HTMLInputElement。",
	},
	{
		name: "classNames",
		type: "{ root?, label?, input?, description?, error? }",
		meaning: "按部件补充类名；调整外层布局使用 root。",
	},
	{
		name: "aria-describedby",
		type: "string",
		meaning: "合并宿主提供的 ID，去重后与内部存在的说明及错误关联。",
	},
	{
		name: "value / defaultValue / onChange",
		type: "原生 input 属性",
		meaning: "保留受控与非受控语义；onChange 接收原生 React 事件。",
	},
];

/** 展示字段关联、原生表单行为与校验状态的消费方式。 */
export function TextFieldDocPage() {
	return (
		<SpecimenDoc>
			<header className="space-y-3">
				<p className="font-mono text-xs text-muted-foreground">基础单元 · TextField</p>
				<h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
					TextField 文本字段
				</h1>
				<p className="text-base leading-relaxed text-muted-foreground">
					将
					Input、Label、说明和错误组合为一个有名称的字段。输入值、校验规则与请求状态由调用方管理。
				</p>
				<p className="text-xs text-muted-foreground">
					源码{" "}
					<code className="font-mono text-foreground">
						web/packages/ui/src/components/text-field/
					</code>
				</p>
			</header>

			<section aria-labelledby="text-field-usage" className="space-y-4">
				<AnchoredHeading
					as="h2"
					id="text-field-usage"
					className="text-xl font-bold text-foreground"
				>
					原生输入与说明
				</AnchoredHeading>
				<p className="text-sm leading-relaxed text-muted-foreground">
					name、autoComplete、maxLength 和 readOnly 保留原生语义。只有 input 外观时使用
					Input，需要字段名称和说明时使用 TextField。
				</p>
				<CodeCard code={basicSource} language="tsx" lineNumbers collapseLines={8}>
					<TextFieldBasicDemo />
				</CodeCard>
			</section>

			<section aria-labelledby="text-field-validation" className="space-y-4">
				<AnchoredHeading
					as="h2"
					id="text-field-validation"
					className="text-xl font-bold text-foreground"
				>
					受控值与校验
				</AnchoredHeading>
				<p className="text-sm leading-relaxed text-muted-foreground">
					输入一个字符后移开焦点，错误出现；补足两个字符后错误消失。组件只渲染校验结果，规则在示例消费方。
				</p>
				<CodeCard code={validationSource} language="tsx" lineNumbers collapseLines={8}>
					<TextFieldValidationDemo />
				</CodeCard>
			</section>

			<section aria-labelledby="text-field-form" className="space-y-4">
				<AnchoredHeading
					as="h2"
					id="text-field-form"
					className="text-xl font-bold text-foreground"
				>
					表单提交与 ref
				</AnchoredHeading>
				<p className="text-sm leading-relaxed text-muted-foreground">
					读取表单会通过 name 获取邮箱值；聚焦按钮调用 input
					ref；重置按钮恢复非受控初值。required 和 type=email 的有效性检查由浏览器处理。
				</p>
				<CodeCard code={formSource} language="tsx" lineNumbers collapseLines={8}>
					<TextFieldFormDemo />
				</CodeCard>
			</section>

			<section aria-labelledby="text-field-api" className="space-y-4">
				<AnchoredHeading
					as="h2"
					id="text-field-api"
					className="text-xl font-bold text-foreground"
				>
					公开契约
				</AnchoredHeading>
				<ApiTable
					title="TextField Props"
					columns={COLUMNS}
					rows={ROWS}
					rowKey={(row) => row.name}
				/>
			</section>

			<section aria-labelledby="text-field-boundaries" className="space-y-4">
				<AnchoredHeading
					as="h2"
					id="text-field-boundaries"
					className="text-xl font-bold text-foreground"
				>
					使用边界
				</AnchoredHeading>
				<ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
					<li>
						className 属于 input；整行宽度与间距使用
						classNames.root，不能把两个入口混用。
					</li>
					<li>每个字段保留 label；placeholder 只补充格式示例，不能替代可访问名称。</li>
					<li>
						TextField 当前组合单个 input；多行内容使用 Label 与
						Textarea，复杂分组按实际语义另行组合。
					</li>
					<li>
						表单库、请求与业务错误由宿主连接；组件没有内置验证 schema 或全局表单状态。
					</li>
				</ul>
			</section>
		</SpecimenDoc>
	);
}
