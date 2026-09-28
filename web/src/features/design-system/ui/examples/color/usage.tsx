import { Button } from "@violet/ui";

/** 组件变体与自定义元素的颜色配对示例。 */
export function ColorUsageDemo() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-3">
			<Button type="button">默认动作</Button>
			<Button type="button" variant="primary">
				主色强调
			</Button>
			<Button type="button" variant="soft">
				柔和淡染
			</Button>
			<span className="rounded-lg bg-primary-base-soft px-3 py-2 text-primary-base-soft-foreground">
				自定义元素
			</span>
		</div>
	);
}
