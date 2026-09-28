import { ApiTable, type ApiTableColumn } from "./ApiTable";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { InputBasicDemo } from "./examples/input/basic";
import basicSource from "./examples/input/basic.tsx?raw";

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
	{ name: "type", type: "原生 input type", meaning: "指定文本、邮箱、密码等原生输入类型。" },
	{
		name: "value / onChange",
		type: "原生 input 属性",
		meaning: "由消费方管理受控值；也可使用 defaultValue 构建非受控输入。",
	},
	{
		name: "disabled / required",
		type: "boolean",
		meaning: "原生禁用和必填属性；具体约束由浏览器或表单逻辑处理。",
	},
	{
		name: "aria-invalid",
		type: "boolean | string",
		meaning: "由消费方标注校验结果，控制错误视觉状态与辅助技术提示。",
	},
	{
		name: "id / aria-describedby",
		type: "string",
		meaning: "关联 Label 与说明文字，避免只有 placeholder 而无可访问名称。",
	},
];

/** 展示 @violet/ui Input 的受控输入和错误状态边界。 */
export function InputDocPage() {
	return (
		<article className="mx-auto w-full max-w-4xl space-y-12 pb-24 font-sans">
			<header className="space-y-3">
				<p className="font-mono text-xs text-muted-foreground">表单 · Input</p>
				<h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
					Input 输入框
				</h1>
				<p className="text-base leading-relaxed text-muted-foreground">
					带 Violet 主题焦点和错误样式的原生 input；输入状态和校验规则仍由消费方负责。
				</p>
				<p className="text-xs text-muted-foreground">
					源码{" "}
					<code className="font-mono text-foreground">
						web/packages/ui/src/input/input.tsx
					</code>
				</p>
			</header>

			<section aria-labelledby="input-usage" className="space-y-4">
				<h2 id="input-usage" className="text-xl font-bold text-foreground">
					用法
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					从 <code className="font-mono">@violet/ui</code> 导入 Input 与
					Label。输入一个字符，再输入第二个字符，观察由示例自身设置的 aria-invalid
					状态变化。
				</p>
				<CodeCard code={basicSource} language="tsx" lineNumbers collapseLines={6}>
					<InputBasicDemo />
				</CodeCard>
			</section>

			<section aria-labelledby="input-api" className="space-y-4">
				<h2 id="input-api" className="text-xl font-bold text-foreground">
					API 与键盘
				</h2>
				<ApiTable
					title="Input 常用原生属性"
					columns={COLUMNS}
					rows={ROWS}
					rowKey={(row) => row.name}
				/>
				<p className="text-sm leading-relaxed text-muted-foreground">
					按 Tab 聚焦后可直接键入、选中和编辑文本；禁用时无法聚焦或输入。这些是原生 input
					行为，不是组件附加的键盘协议。
				</p>
				<p className="text-sm leading-relaxed text-muted-foreground">
					限制：Input
					不包含校验器、错误文案或表单提交逻辑。示例中的长度规则仅供演示，业务表单需要自行定义规则并传入
					aria-invalid。
				</p>
			</section>
		</article>
	);
}
