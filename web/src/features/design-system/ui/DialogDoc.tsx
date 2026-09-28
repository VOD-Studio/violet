import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";
import { ApiTable, type ApiTableColumn } from "./ApiTable";
import { DialogBasicDemo } from "./examples/dialog/basic";
import basicSource from "./examples/dialog/basic.tsx?raw";

interface PropRow {
	name: string;
	type: string;
	meaning: string;
}

const COLUMNS: ApiTableColumn<PropRow>[] = [
	{ label: "组件 / 属性", cellClassName: "font-mono text-foreground", render: (row) => row.name },
	{ label: "类型", cellClassName: "font-mono text-muted-foreground", render: (row) => row.type },
	{ label: "用途", cellClassName: "text-muted-foreground", render: (row) => row.meaning },
];

const ROWS: PropRow[] = [
	{
		name: "Dialog",
		type: "open?, defaultOpen?, onOpenChange?",
		meaning: "根组件；可受控或使用非受控初始状态。",
	},
	{
		name: "DialogTrigger",
		type: "asChild?",
		meaning: "触发打开；asChild 将行为赋给唯一子元素。",
	},
	{
		name: "DialogContent",
		type: "showCloseButton?: boolean",
		meaning: "对话框内容，默认显示右上角关闭按钮；内部自动渲染 Portal 与遮罩。",
	},
	{
		name: "DialogTitle / DialogDescription",
		type: "children",
		meaning: "提供对话框的可访问名称与说明。",
	},
	{ name: "DialogClose", type: "asChild?", meaning: "显式关闭操作，可将行为赋给按钮。" },
];

/** 展示 @violet/ui Dialog 的结构、交互和无障碍约束。 */
export function DialogDocPage() {
	return (
		<article className="mx-auto w-full max-w-4xl space-y-12 pb-24 font-sans">
			<header className="space-y-3">
				<p className="font-mono text-xs text-muted-foreground">反馈 · Dialog</p>
				<h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
					Dialog 对话框
				</h1>
				<p className="text-base leading-relaxed text-muted-foreground">
					用于需要用户集中处理的内容。通过根组件组合触发器、内容、标题和关闭动作。
				</p>
				<p className="text-xs text-muted-foreground">
					源码{" "}
					<code className="font-mono text-foreground">
						web/packages/ui/src/dialog/dialog.tsx
					</code>
				</p>
			</header>

			<section aria-labelledby="dialog-usage" className="space-y-4">
				<h2 id="dialog-usage" className="text-xl font-bold text-foreground">
					用法
				</h2>
				<p className="text-sm leading-relaxed text-muted-foreground">
					以下示例直接从 <code className="font-mono">@violet/ui</code>{" "}
					导入；点击打开，使用关闭按钮、右上角按钮或 Escape 退出。
				</p>
				<CodeCard code={basicSource} language="tsx" lineNumbers collapseLines={6}>
					<DialogBasicDemo />
				</CodeCard>
			</section>

			<section aria-labelledby="dialog-api" className="space-y-4">
				<h2 id="dialog-api" className="text-xl font-bold text-foreground">
					API 与键盘
				</h2>
				<ApiTable
					title="Dialog 关键组合件"
					columns={COLUMNS}
					rows={ROWS}
					rowKey={(row) => row.name}
				/>
				<p className="text-sm leading-relaxed text-muted-foreground">
					基于 Radix Dialog：打开后焦点进入对话框并限制在其中；Escape
					默认关闭，关闭后焦点返回触发器。不要省略
					DialogTitle；仅在适合遮罩外点击即可取消的场景使用默认外部关闭行为。
				</p>
				<p className="text-sm leading-relaxed text-muted-foreground">
					限制：Dialog
					只负责弹层交互，不会替你提交表单、校验数据或持久化更改；实际操作请在消费方实现。
				</p>
			</section>
		</article>
	);
}
