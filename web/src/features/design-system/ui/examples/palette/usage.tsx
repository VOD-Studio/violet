import { Button } from "@violet/ui";

/** 语义用色演示：组件选 variant，自定义元素消费语义工具类，不写具体色值。 */
export function PaletteUsageDemo() {
	return (
		<div className="flex flex-wrap items-center gap-3">
			<Button type="button" variant="primary">
				保存
			</Button>
			<Button type="button" variant="soft">
				稍后处理
			</Button>
			{/* solid 与 foreground 成对；hover 走主色源派生态 */}
			<button
				className="rounded-lg bg-primary-base px-4 py-2 text-sm text-primary-base-foreground transition-colors hover:bg-primary-base-hover"
				type="button"
			>
				自定义元素
			</button>
		</div>
	);
}
