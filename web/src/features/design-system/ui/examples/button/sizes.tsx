import { Button } from "@violet/ui";
import { Plus } from "lucide-react";

/** 按钮尺寸梯度；纯图标按钮用 icon 档位并提供 aria-label。 */
export function ButtonSizesDemo() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-3">
			<Button type="button" size="xs">
				极小 xs
			</Button>
			<Button type="button" size="sm">
				小 sm
			</Button>
			<Button type="button" size="default">
				默认
			</Button>
			<Button type="button" size="lg">
				大 lg
			</Button>
			<Button type="button" size="xl">
				特大 xl
			</Button>
			<Button type="button" size="icon" aria-label="新建">
				<Plus aria-hidden="true" />
			</Button>
		</div>
	);
}
