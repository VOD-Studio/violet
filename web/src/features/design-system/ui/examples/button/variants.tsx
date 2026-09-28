import { Button } from "@violet/ui";

/** 按钮视觉层级变体一览。 */
export function ButtonVariantsDemo() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-3">
			<Button type="button" variant="default">
				主要动作
			</Button>
			<Button type="button" variant="brand">
				品牌强调
			</Button>
			<Button type="button" variant="secondary">
				次要动作
			</Button>
			<Button type="button" variant="soft">
				柔和淡染
			</Button>
			<Button type="button" variant="outline">
				描边动作
			</Button>
			<Button type="button" variant="ghost">
				轻量动作
			</Button>
			<Button type="button" variant="link">
				文字动作
			</Button>
			<Button type="button" variant="destructive">
				危险操作
			</Button>
		</div>
	);
}
