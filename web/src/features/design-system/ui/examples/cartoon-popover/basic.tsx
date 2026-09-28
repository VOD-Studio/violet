import {
	CartoonPopover,
	CartoonPopoverContent,
	CartoonPopoverTrigger,
} from "@shared/ui/cartoon-popover";
import { Button } from "@violet/ui";

/** 点击触发的基础卡通气泡。 */
export function CartoonPopoverBasicDemo() {
	return (
		<div className="flex justify-center py-6">
			<CartoonPopover>
				<CartoonPopoverTrigger asChild>
					<Button type="button" variant="default">
						打开卡通气泡
					</Button>
				</CartoonPopoverTrigger>
				<CartoonPopoverContent
					title="你好，旅人！"
					description="欢迎来到紫罗兰的营造法式典籍。"
					showClose
					side="bottom"
					variant="brand"
				>
					<div className="space-y-1 pt-1 text-xs">
						<p>对白小尾巴与气泡边框平滑连通，内部背景无阻隔。</p>
						<p className="text-muted-foreground">
							支持点击、悬停与视口防溢出自动对齐。
						</p>
					</div>
				</CartoonPopoverContent>
			</CartoonPopover>
		</div>
	);
}
